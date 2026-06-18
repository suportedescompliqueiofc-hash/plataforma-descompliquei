import { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  Swords, Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight,
  Video, FileText, Code, LayoutTemplate, Save, X,
  Globe, BookOpen, Upload, File,
} from 'lucide-react';
import { getRichExtensions, RichToolbar, EDITOR_STYLES } from '@/components/editor/RichEditor';
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
  useAdminCategorias, useCreateCategoria, useUpdateCategoria, useDeleteCategoria,
  useAdminFerramentas, useCreateFerramenta, useUpdateFerramenta, useDeleteFerramenta,
  useAdminArsenalMateriais, useCreateArsenalMaterial, useUpdateArsenalMaterial, useDeleteArsenalMaterial,
  useAdminArsenalTemplates, useCreateArsenalTemplate, useUpdateArsenalTemplate, useDeleteArsenalTemplate,
  AdminCategoria, AdminFerramenta, AdminArsenalMaterial, AdminArsenalTemplate,
  toSlug,
} from '@/hooks/useAdminArsenal';
import AdminArsenalAulas from './AdminArsenalAulas';

// ─── Cores por slug ───────────────────────────────────────────────────────────

const SLUG_COLORS: Record<string, { dot: string; badge: string; text: string }> = {
  'diagnostico-clareza':                { dot: 'bg-violet-500', badge: 'bg-violet-50 border-violet-200',  text: 'text-violet-700' },
  'oferta-precificacao-valor':          { dot: 'bg-amber-500',  badge: 'bg-amber-50 border-amber-200',   text: 'text-amber-700' },
  'atendimento-conversao':              { dot: 'bg-cyan-500',   badge: 'bg-cyan-50 border-cyan-200',     text: 'text-cyan-700' },
  'funil-followup-reativacao':          { dot: 'bg-emerald-500',badge: 'bg-emerald-50 border-emerald-200',text: 'text-emerald-700' },
  'alto-ticket-protocolos-recorrencia': { dot: 'bg-rose-500',   badge: 'bg-rose-50 border-rose-200',    text: 'text-rose-700' },
  'canais-aquisicao':                   { dot: 'bg-blue-500',   badge: 'bg-blue-50 border-blue-200',    text: 'text-blue-700' },
  'montando-equipe-comercial':          { dot: 'bg-orange-500', badge: 'bg-orange-50 border-orange-200',text: 'text-orange-700' },
  'gestao-time-comercial':              { dot: 'bg-indigo-500', badge: 'bg-indigo-50 border-indigo-200',text: 'text-indigo-700' },
};
const DEFAULT_C = { dot: 'bg-muted-foreground', badge: 'bg-muted/40 border-border/60', text: 'text-muted-foreground' };
function slugColors(slug?: string) { return slug ? (SLUG_COLORS[slug] ?? DEFAULT_C) : DEFAULT_C; }

// ─── Template Modal (com TipTap) ──────────────────────────────────────────────

interface TemplateModalProps {
  open: boolean;
  onClose: () => void;
  template: Partial<AdminArsenalTemplate> | null;
  ferramentas: AdminFerramenta[];
}

function TemplateModal({ open, onClose, template, ferramentas }: TemplateModalProps) {
  const createT = useCreateArsenalTemplate();
  const updateT = useUpdateArsenalTemplate();
  const isEdit = !!template?.id;

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ferrId, setFerrId] = useState('');
  const [catId, setCatId] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [ordem, setOrdem] = useState(0);
  const [ativo, setAtivo] = useState(true);

  // Categorias únicas derivadas das ferramentas
  const categorias = useMemo(() => {
    const seen = new Map<string, { id: string; nome: string; slug: string }>();
    for (const f of ferramentas) {
      const c = f.arsenal_categorias;
      if (c && !seen.has(c.id)) seen.set(c.id, c);
    }
    return Array.from(seen.values());
  }, [ferramentas]);

  const ferraBycat = useMemo(() =>
    catFilter ? ferramentas.filter(f => f.arsenal_categorias?.id === catFilter) : ferramentas,
  [ferramentas, catFilter]);

  const editor = useEditor({
    extensions: getRichExtensions(),
    content: '',
    editorProps: { attributes: { class: 'outline-none min-h-[200px] cursor-text' } },
  });

  useEffect(() => {
    if (open && template) {
      setTitulo(template.titulo ?? '');
      setDescricao(template.descricao ?? '');
      setFerrId(template.ferramenta_id ?? '');
      setCatId(template.categoria_arsenal_id ?? '');
      setCatFilter(template.categoria_arsenal_id ?? '');
      setOrdem(template.ordem ?? 0);
      setAtivo(template.ativo ?? true);
      editor?.commands.setContent(template.conteudo ?? '');
    } else if (!open) {
      setTitulo(''); setDescricao(''); setFerrId(''); setCatId(''); setCatFilter(''); setOrdem(0); setAtivo(true);
      editor?.commands.setContent('');
    }
  }, [open, template, editor]);

  const handleSelectCat = (id: string) => {
    setCatFilter(id);
    setCatId(id);
    setFerrId(''); // limpa ferramenta ao trocar categoria
  };

  const handleSelectFerr = (id: string) => {
    setFerrId(id);
    const ferr = ferramentas.find(f => f.id === id);
    if (ferr) { setCatId(ferr.arsenal_categorias?.id ?? ''); setCatFilter(ferr.arsenal_categorias?.id ?? ''); }
  };

  const handleSave = async () => {
    if (!titulo.trim() || !ferrId || !catId) {
      toast.error('Preencha título e ferramenta.'); return;
    }
    const conteudo = editor?.getHTML() ?? '';
    try {
      if (isEdit && template?.id) {
        await updateT.mutateAsync({ id: template.id, titulo, descricao: descricao || null, conteudo, ferramenta_id: ferrId, categoria_arsenal_id: catId, ordem, ativo });
        toast.success('Template atualizado.');
      } else {
        await createT.mutateAsync({ titulo, descricao: descricao || undefined, conteudo, ferramenta_id: ferrId, categoria_arsenal_id: catId, ordem });
        toast.success('Template criado.');
      }
      onClose();
    } catch { toast.error('Erro ao salvar template.'); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-muted">
              <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-foreground">{isEdit ? 'Editar Template' : 'Novo Template'}</p>
              <p className="text-[11px] text-muted-foreground/60">Conteúdo rico vinculado a uma ferramenta do Arsenal</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[75vh] px-6 py-5 space-y-5">
          {/* Título */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Nome do template" className="h-9 text-sm" autoFocus />
          </div>

          {/* Vínculo */}
          <div className="rounded-xl border border-border/60 bg-muted/[0.02] p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Vínculo</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
                <Select value={catFilter} onValueChange={handleSelectCat}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ferramenta *</Label>
                <Select value={ferrId} onValueChange={handleSelectFerr} disabled={ferraBycat.length === 0}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={catFilter ? 'Selecionar ferramenta' : 'Selecione a categoria primeiro'} />
                  </SelectTrigger>
                  <SelectContent>
                    {ferraBycat.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição <span className="text-muted-foreground/40 normal-case font-normal">(opcional)</span></Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Explique brevemente o que este template ajuda a construir..." rows={2} className="text-sm resize-none" />
          </div>

          {/* Conteúdo */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conteúdo do Template</Label>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="border-b border-border/40 bg-muted/[0.02]">
                <RichToolbar editor={editor} compact />
              </div>
              <div
                className={cn('px-5 py-4 bg-card cursor-text', EDITOR_STYLES, '[&_.ProseMirror]:min-h-[200px]')}
                onClick={() => editor?.commands.focus()}
              >
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          {/* Rodapé do form */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ordem</Label>
                <Input type="number" value={ordem} onChange={e => setOrdem(Number(e.target.value))} className="h-9 w-20 text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <div>
                <p className="text-[13px] font-medium text-foreground">Ativo</p>
                <p className="text-[10px] text-muted-foreground/50">Visível na ferramenta</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-border/40 bg-muted/20">
          <Button variant="ghost" onClick={onClose} className="h-9 text-sm">Cancelar</Button>
          <Button onClick={handleSave} disabled={createT.isPending || updateT.isPending}
            className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5">
            {(createT.isPending || updateT.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isEdit ? 'Salvar alterações' : 'Criar template'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Material Modal ───────────────────────────────────────────────────────────

interface MaterialModalProps {
  open: boolean;
  onClose: () => void;
  material: Partial<AdminArsenalMaterial> | null;
  ferramentas: AdminFerramenta[];
}

function MaterialModal({ open, onClose, material, ferramentas }: MaterialModalProps) {
  const createM = useCreateArsenalMaterial();
  const updateM = useUpdateArsenalMaterial();
  const isEdit = !!material?.id;

  const [catFilter, setCatFilter] = useState('');
  const [ferrId, setFerrId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'pdf' | 'html'>('pdf');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState(''); // URL já existente (edição)
  const [htmlContent, setHtmlContent] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categorias = useMemo(() => {
    const seen = new Map<string, { id: string; nome: string }>();
    for (const f of ferramentas) {
      const c = f.arsenal_categorias;
      if (c && !seen.has(c.id)) seen.set(c.id, c);
    }
    return Array.from(seen.values());
  }, [ferramentas]);

  const ferraBycat = useMemo(() =>
    catFilter ? ferramentas.filter(f => f.arsenal_categorias?.id === catFilter) : ferramentas,
  [ferramentas, catFilter]);

  useEffect(() => {
    if (open && material) {
      setFerrId(material.ferramenta_id ?? '');
      const ferr = ferramentas.find(f => f.id === material.ferramenta_id);
      setCatFilter(ferr?.arsenal_categorias?.id ?? '');
      setTitulo(material.titulo ?? '');
      setTipo(material.tipo ?? 'pdf');
      setPdfUrl(material.pdf_url ?? '');
      setPdfFile(null);
      setHtmlContent(material.conteudo_html ?? '');
      setAtivo(material.ativo ?? true);
    } else if (!open) {
      setCatFilter(''); setFerrId(''); setTitulo(''); setTipo('pdf');
      setPdfFile(null); setPdfUrl(''); setHtmlContent(''); setAtivo(true);
    }
  }, [open, material, ferramentas]);

  const handleSelectCat = (id: string) => { setCatFilter(id); setFerrId(''); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { toast.error('Apenas arquivos PDF são aceitos.'); return; }
    if (f.size > 52428800) { toast.error('Arquivo muito grande. Máximo: 50 MB.'); return; }
    setPdfFile(f);
  };

  const handleSave = async () => {
    if (!titulo.trim() || !ferrId) { toast.error('Preencha título e ferramenta.'); return; }
    if (tipo === 'pdf' && !pdfFile && !pdfUrl) { toast.error('Selecione um arquivo PDF.'); return; }

    let finalPdfUrl = pdfUrl;

    if (tipo === 'pdf' && pdfFile) {
      setUploading(true);
      try {
        const ext = pdfFile.name.split('.').pop();
        const path = `${ferrId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('arsenal-materiais')
          .upload(path, pdfFile, { upsert: true, contentType: 'application/pdf' });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('arsenal-materiais').getPublicUrl(path);
        finalPdfUrl = urlData.publicUrl;
      } catch (e: any) {
        toast.error('Erro ao fazer upload: ' + (e?.message ?? 'Tente novamente.'));
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const payload = {
      ferramenta_id: ferrId, titulo, tipo, ativo,
      pdf_url: tipo === 'pdf' ? finalPdfUrl : null,
      conteudo_html: tipo === 'html' ? htmlContent : null,
    };
    try {
      if (isEdit && material?.id) {
        await updateM.mutateAsync({ id: material.id, ...payload });
        toast.success('Material atualizado.');
      } else {
        await createM.mutateAsync(payload as any);
        toast.success('Material criado.');
      }
      onClose();
    } catch { toast.error('Erro ao salvar material.'); }
  };

  const isSaving = uploading || createM.isPending || updateM.isPending;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-muted">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-foreground">{isEdit ? 'Editar Material' : 'Novo Material'}</p>
              <p className="text-[11px] text-muted-foreground/60">PDF ou HTML vinculado a uma ferramenta do Arsenal</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Vínculo */}
          <div className="rounded-xl border border-border/60 bg-muted/[0.02] p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Vínculo</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
                <Select value={catFilter} onValueChange={handleSelectCat}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ferramenta *</Label>
                <Select value={ferrId} onValueChange={setFerrId} disabled={ferraBycat.length === 0}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={catFilter ? 'Selecionar' : 'Selecione a categoria'} />
                  </SelectTrigger>
                  <SelectContent>
                    {ferraBycat.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Nome do material" className="h-9 text-sm" autoFocus />
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo de conteúdo</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['pdf', 'html'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                    tipo === t
                      ? t === 'pdf'
                        ? 'border-red-200 bg-red-50/60 text-red-700'
                        : 'border-blue-200 bg-blue-50/60 text-blue-700'
                      : 'border-border/60 text-muted-foreground hover:border-border hover:bg-muted/20'
                  )}
                >
                  {t === 'pdf'
                    ? <FileText className="h-4 w-4 shrink-0" />
                    : <Code className="h-4 w-4 shrink-0" />}
                  <div>
                    <p className="text-[12px] font-bold">{t.toUpperCase()}</p>
                    <p className="text-[10px] opacity-70 font-normal">{t === 'pdf' ? 'Arquivo PDF' : 'Conteúdo HTML'}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Conteúdo */}
          {tipo === 'pdf' ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Arquivo PDF *</Label>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
              {pdfFile ? (
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50">
                  <div className="p-2 rounded-lg bg-emerald-100"><File className="h-4 w-4 text-emerald-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{pdfFile.name}</p>
                    <p className="text-[11px] text-muted-foreground/60">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB · pronto para envio</p>
                  </div>
                  <button onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : pdfUrl ? (
                <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/10">
                  <div className="p-2 rounded-lg bg-red-50"><File className="h-4 w-4 text-red-500" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">PDF enviado</p>
                    <p className="text-[11px] text-muted-foreground/50 truncate">{pdfUrl}</p>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    Trocar
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-border/60 hover:border-foreground/20 hover:bg-muted/20 transition-all group">
                  <div className="p-3 rounded-xl bg-muted/40 group-hover:bg-muted transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-muted-foreground">Clique para selecionar o PDF</p>
                    <p className="text-[11px] text-muted-foreground/40 mt-0.5">Máximo 50 MB · apenas PDF</p>
                  </div>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Code className="h-3 w-3" /> Conteúdo HTML
              </Label>
              <Textarea value={htmlContent} onChange={e => setHtmlContent(e.target.value)} placeholder="<html>...</html>" rows={8} className="text-sm font-mono text-xs resize-none bg-muted/20" />
            </div>
          )}

          {/* Ativo */}
          <div className="flex items-center gap-3 pt-1 border-t border-border/40">
            <Switch checked={ativo} onCheckedChange={setAtivo} />
            <div>
              <p className="text-[13px] font-medium text-foreground">Material ativo</p>
              <p className="text-[11px] text-muted-foreground/50">Visível para os alunos na plataforma</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-border/40 bg-muted/20">
          <Button variant="ghost" onClick={onClose} disabled={isSaving} className="h-9 text-sm">Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}
            className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {uploading ? 'Enviando PDF...' : isEdit ? 'Salvar alterações' : 'Criar material'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Categoria Modal ──────────────────────────────────────────────────────────

interface CategoriaModalProps {
  open: boolean;
  onClose: () => void;
  categoria: AdminCategoria | null;
  nextOrdem: number;
}

const CAT_COLORS = [
  { label: 'Cinza',    value: 'slate',   tw: 'bg-slate-500' },
  { label: 'Vermelho', value: 'red',     tw: 'bg-red-500' },
  { label: 'Laranja',  value: 'orange',  tw: 'bg-orange-500' },
  { label: 'Âmbar',   value: 'amber',   tw: 'bg-amber-500' },
  { label: 'Verde',    value: 'green',   tw: 'bg-green-500' },
  { label: 'Esmeralda',value: 'emerald', tw: 'bg-emerald-500' },
  { label: 'Teal',     value: 'teal',    tw: 'bg-teal-500' },
  { label: 'Ciano',    value: 'cyan',    tw: 'bg-cyan-500' },
  { label: 'Azul',     value: 'blue',    tw: 'bg-blue-500' },
  { label: 'Índigo',   value: 'indigo',  tw: 'bg-indigo-500' },
  { label: 'Violeta',  value: 'violet',  tw: 'bg-violet-500' },
  { label: 'Roxo',     value: 'purple',  tw: 'bg-purple-500' },
  { label: 'Rosa',     value: 'pink',    tw: 'bg-pink-500' },
  { label: 'Rose',     value: 'rose',    tw: 'bg-rose-500' },
];

function CategoriaModal({ open, onClose, categoria, nextOrdem }: CategoriaModalProps) {
  const createC = useCreateCategoria();
  const updateC = useUpdateCategoria();
  const isEdit = !!categoria?.id;

  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('');

  useEffect(() => {
    if (open && categoria) { setNome(categoria.nome); setCor(categoria.cor ?? ''); }
    else if (open && !categoria) { setNome(''); setCor(''); }
  }, [open, categoria]);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error('Informe o nome da categoria.'); return; }
    const slug = toSlug(nome);
    try {
      if (isEdit && categoria?.id) {
        await updateC.mutateAsync({ id: categoria.id, nome, slug, cor: cor || null });
        toast.success('Categoria atualizada.');
      } else {
        await createC.mutateAsync({ nome, slug, ordem: nextOrdem, cor: cor || null });
        toast.success('Categoria criada.');
      }
      onClose();
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao salvar categoria.'); }
  };

  const selectedColor = CAT_COLORS.find(c => c.value === cor);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/40">
          <DialogTitle className="text-[15px] font-semibold">{isEdit ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Diagnóstico e Clareza" className="h-9 text-sm" autoFocus />
            {nome && (
              <p className="text-[11px] text-muted-foreground/50">Slug: <span className="font-mono">{toSlug(nome)}</span></p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cor</Label>
              {selectedColor && (
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-3 w-3 rounded-full', selectedColor.tw)} />
                  <span className="text-[11px] text-muted-foreground">{selectedColor.label}</span>
                  <button onClick={() => setCor('')} className="text-[10px] text-muted-foreground/50 hover:text-foreground ml-1">limpar</button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {CAT_COLORS.map(c => (
                <button
                  key={c.value}
                  title={c.label}
                  onClick={() => setCor(c.value)}
                  className={cn(
                    'h-7 w-7 rounded-full transition-all border-2',
                    c.tw,
                    cor === c.value
                      ? 'border-foreground scale-110 shadow-md'
                      : 'border-transparent hover:scale-105 hover:border-foreground/30'
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button variant="ghost" onClick={onClose} className="h-9 text-sm">Cancelar</Button>
          <Button onClick={handleSave} disabled={createC.isPending || updateC.isPending}
            className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5">
            {(createC.isPending || updateC.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isEdit ? 'Salvar' : 'Criar categoria'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Categoria Detail Dialog ──────────────────────────────────────────────────

interface CategoriaDetailDialogProps {
  open: boolean;
  cat: { id: string; nome: string; slug?: string; cor?: string | null } | null;
  ferramentas: AdminFerramenta[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditFerr: (f: AdminFerramenta) => void;
  onDeleteFerr: (id: string, nome: string) => void;
  onAddFerr: () => void;
  onOpenFerr: (f: AdminFerramenta) => void;
}

function CategoriaDetailDialog({
  open, cat, ferramentas: ferrList, onClose, onEdit, onDelete, onEditFerr, onDeleteFerr, onAddFerr, onOpenFerr,
}: CategoriaDetailDialogProps) {
  const updateF = useUpdateFerramenta();

  const catCorObj = cat?.cor ? CAT_COLORS.find(x => x.value === cat.cor) : null;
  const c = slugColors(cat?.slug);
  const dotClass = catCorObj ? catCorObj.tw : c.dot;

  const ativas = ferrList.filter(f => f.ativo).length;
  const inativas = ferrList.filter(f => !f.ativo).length;
  const comVideo = ferrList.filter(f => f.video_url).length;
  const comTexto = ferrList.filter(f => f.texto_aprenda).length;

  const toggleAtivo = async (f: AdminFerramenta) => {
    await updateF.mutateAsync({ id: f.id, ativo: !f.ativo });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl w-full p-0 flex flex-col overflow-hidden rounded-2xl border border-border/60 max-h-[85vh]">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-3">
            <span className={cn('w-3 h-3 rounded-full shrink-0', dotClass)} />
            <h2 className="text-[15px] font-bold text-foreground font-display flex-1">{cat?.nome}</h2>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border/40">
              {ferrList.length} ferramenta{ferrList.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 space-y-5">

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: 'Total', value: ferrList.length, color: 'text-foreground' },
                { label: 'Ativas', value: ativas, color: 'text-emerald-500' },
                { label: 'Inativas', value: inativas, color: inativas > 0 ? 'text-amber-500' : 'text-muted-foreground' },
                { label: 'Com vídeo', value: comVideo, color: 'text-blue-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-border/60 bg-card px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
                  <p className={cn('text-xl font-bold tabular-nums font-display', color)}>{value}</p>
                </div>
              ))}
            </div>

            {/* Ferramentas list */}
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Ferramentas</p>
                <button
                  onClick={onAddFerr}
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" /> Nova ferramenta
                </button>
              </div>

              {ferrList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="p-2.5 rounded-xl bg-muted/40 mb-2.5">
                    <Swords className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-[12px] text-muted-foreground">Nenhuma ferramenta nesta categoria</p>
                  <button onClick={onAddFerr} className="text-[11px] text-muted-foreground/60 hover:text-foreground mt-1 underline underline-offset-2">
                    Adicionar primeira ferramenta
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {ferrList.map(f => (
                    <div key={f.id}
                      className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/10 transition-colors cursor-pointer"
                      onClick={() => onOpenFerr(f)}
                    >
                      {/* Active indicator */}
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', f.ativo ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />

                      {/* Name + badges */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={cn('text-[13px] font-medium', !f.ativo && 'text-muted-foreground/50 line-through')}>
                            {f.nome}
                          </p>
                          {!f.ativo && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/40 uppercase">
                              Inativa
                            </span>
                          )}
                        </div>
                        {f.descricao && (
                          <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5 max-w-sm">{f.descricao}</p>
                        )}
                      </div>

                      {/* Content badges */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {f.video_url && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase">
                            Vídeo
                          </span>
                        )}
                        {f.texto_aprenda && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-500 border border-violet-500/20 uppercase">
                            Texto
                          </span>
                        )}
                      </div>

                      {/* Actions (hover-reveal) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); toggleAtivo(f); }}
                          title={f.ativo ? 'Desativar' : 'Ativar'}
                          className={cn(
                            'h-7 px-2 rounded-lg text-[10px] font-semibold border transition-colors',
                            f.ativo
                              ? 'text-muted-foreground border-border/60 hover:bg-muted/50'
                              : 'text-emerald-600 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                          )}
                        >
                          {f.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onEditFerr(f); }}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onDeleteFerr(f.id, f.nome); }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-t border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Pencil className="h-3 w-3" /> Editar categoria
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold border border-destructive/20 text-destructive/60 hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Excluir
            </button>
          </div>
          <Button
            onClick={onAddFerr}
            className="h-8 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Nova Ferramenta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ferramenta Detail Dialog ─────────────────────────────────────────────────

interface FerramentaDetailDialogProps {
  open: boolean;
  ferramenta: AdminFerramenta | null;
  materiais: AdminArsenalMaterial[];
  templates: AdminArsenalTemplate[];
  onClose: () => void;
  onAddMaterial: () => void;
  onAddTemplate: () => void;
  onEditMaterial: (m: AdminArsenalMaterial) => void;
  onEditTemplate: (t: AdminArsenalTemplate) => void;
  onDeleteMaterial: (id: string, titulo: string) => void;
  onDeleteTemplate: (id: string, titulo: string) => void;
}

function FerramentaDetailDialog({
  open, ferramenta, materiais, templates,
  onClose, onAddMaterial, onAddTemplate,
  onEditMaterial, onEditTemplate, onDeleteMaterial, onDeleteTemplate,
}: FerramentaDetailDialogProps) {
  const updateF = useUpdateFerramenta();
  const cat = ferramenta?.arsenal_categorias;
  const c = slugColors(cat?.slug);

  const [editing, setEditing] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');

  useEffect(() => {
    if (ferramenta) {
      setEditNome(ferramenta.nome ?? '');
      setEditDescricao(ferramenta.descricao ?? '');
      setEditVideoUrl(ferramenta.video_url ?? '');
    }
    setEditing(false);
  }, [ferramenta?.id]);

  const toggleAtivo = async () => {
    if (!ferramenta) return;
    await updateF.mutateAsync({ id: ferramenta.id, ativo: !ferramenta.ativo });
  };

  const handleSave = async () => {
    if (!ferramenta) return;
    try {
      await updateF.mutateAsync({
        id: ferramenta.id,
        nome: editNome.trim() || ferramenta.nome,
        descricao: editDescricao || '',
        video_url: editVideoUrl || null,
      });
      toast.success('Ferramenta atualizada.');
      setEditing(false);
    } catch { toast.error('Erro ao salvar.'); }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl w-full p-0 flex flex-col overflow-hidden rounded-2xl border border-border/60 max-h-[85vh]">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-3">
            <span className={cn('w-3 h-3 rounded-full shrink-0', c.dot)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] font-bold text-foreground font-display">{ferramenta?.nome}</h2>
                {cat && (
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', c.badge, c.text)}>
                    {cat.nome}
                  </span>
                )}
                <span className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                  ferramenta?.ativo
                    ? 'bg-emerald-50 border-emerald-200/60 text-emerald-600'
                    : 'bg-muted border-border/40 text-muted-foreground'
                )}>
                  {ferramenta?.ativo ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              {ferramenta?.descricao && (
                <p className="text-[12px] text-muted-foreground/60 mt-0.5 line-clamp-2">{ferramenta.descricao}</p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6 space-y-5">

            {/* Edit form (inline) */}
            {editing && (
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border/40 bg-muted/[0.03]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Editar ferramenta</p>
                </div>
                <div className="px-4 py-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
                    <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-9 text-sm font-semibold" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição curta</Label>
                    <Input value={editDescricao} onChange={e => setEditDescricao(e.target.value)} placeholder="Breve descrição..." className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Video className="h-3 w-3" /> URL do Vídeo (YouTube)
                    </Label>
                    <Input value={editVideoUrl} onChange={e => setEditVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="h-9 text-sm font-mono text-xs" />
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Materiais', value: `${materiais.length}`, color: 'text-blue-500' },
                { label: 'Templates', value: `${templates.length}`, color: 'text-violet-500' },
                { label: 'Tem vídeo', value: ferramenta?.video_url ? 'Sim' : 'Não', color: ferramenta?.video_url ? 'text-emerald-500' : 'text-muted-foreground/40' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-border/60 bg-card px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
                  <p className={cn('text-xl font-bold font-display', color)}>{value}</p>
                </div>
              ))}
            </div>

            {/* Materiais */}
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Materiais de Apoio</p>
                </div>
                <button onClick={onAddMaterial}
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
              {materiais.length === 0 ? (
                <div className="py-7 text-center">
                  <p className="text-[12px] text-muted-foreground/50">Nenhum material cadastrado</p>
                  <button onClick={onAddMaterial}
                    className="text-[11px] text-muted-foreground/40 hover:text-foreground mt-1 underline underline-offset-2 transition-colors">
                    Adicionar primeiro material
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {materiais.map(m => (
                    <div key={m.id} className="group flex items-center gap-3 px-4 py-2.5">
                      <div className={cn('p-1.5 rounded-lg shrink-0', m.tipo === 'pdf' ? 'bg-red-50' : 'bg-blue-50')}>
                        {m.tipo === 'pdf'
                          ? <FileText className="h-3 w-3 text-red-500" />
                          : <Code className="h-3 w-3 text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">{m.titulo}</p>
                        <p className="text-[10px] text-muted-foreground/50 uppercase">{m.tipo}</p>
                      </div>
                      <span className={cn(
                        'shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border',
                        m.ativo ? 'bg-emerald-50 border-emerald-200/60 text-emerald-600' : 'bg-muted border-border/40 text-muted-foreground'
                      )}>
                        {m.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {m.pdf_url && (
                          <a href={m.pdf_url} target="_blank" rel="noreferrer"
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Ver PDF">
                            <Globe className="h-3 w-3 text-muted-foreground" />
                          </a>
                        )}
                        <button onClick={() => onEditMaterial(m)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button onClick={() => onDeleteMaterial(m.id, m.titulo)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Templates */}
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Templates</p>
                </div>
                <button onClick={onAddTemplate}
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              </div>
              {templates.length === 0 ? (
                <div className="py-7 text-center">
                  <p className="text-[12px] text-muted-foreground/50">Nenhum template cadastrado</p>
                  <button onClick={onAddTemplate}
                    className="text-[11px] text-muted-foreground/40 hover:text-foreground mt-1 underline underline-offset-2 transition-colors">
                    Adicionar primeiro template
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {templates.map(t => (
                    <div key={t.id} className="group flex items-center gap-3 px-4 py-2.5">
                      <div className="p-1.5 rounded-lg bg-violet-50 shrink-0">
                        <LayoutTemplate className="h-3 w-3 text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">{t.titulo}</p>
                        {t.descricao && <p className="text-[10px] text-muted-foreground/50 truncate">{t.descricao}</p>}
                      </div>
                      <span className={cn(
                        'shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border',
                        t.ativo ? 'bg-emerald-50 border-emerald-200/60 text-emerald-600' : 'bg-muted border-border/40 text-muted-foreground'
                      )}>
                        {t.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => onEditTemplate(t)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button onClick={() => onDeleteTemplate(t.id, t.titulo)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-t border-border/40 bg-muted/20">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                <X className="h-3 w-3" /> Cancelar
              </button>
              <button onClick={handleSave} disabled={updateF.isPending}
                className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50">
                {updateF.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Salvar alterações
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                <ChevronRight className="h-3 w-3 rotate-180" /> Voltar
              </button>
              <div className="flex items-center gap-2">
                <button onClick={toggleAtivo}
                  className={cn(
                    'h-8 px-3 rounded-lg text-[11px] font-semibold border transition-colors',
                    ferramenta?.ativo
                      ? 'text-muted-foreground border-border/60 hover:bg-muted/50'
                      : 'text-emerald-600 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                  )}>
                  {ferramenta?.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors">
                  <Pencil className="h-3 w-3" /> Editar ferramenta
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Nova Ferramenta Modal ────────────────────────────────────────────────────

interface NovaFerramentaModalProps {
  open: boolean;
  onClose: () => void;
  categorias: AdminCategoria[];
  nextOrdem: number;
}

function NovaFerramentaModal({ open, onClose, categorias, nextOrdem }: NovaFerramentaModalProps) {
  const createF = useCreateFerramenta();

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [catId, setCatId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  useEffect(() => {
    if (open) { setNome(''); setDescricao(''); setCatId(''); setVideoUrl(''); }
  }, [open]);

  const handleSave = async () => {
    if (!nome.trim() || !catId) { toast.error('Preencha nome e categoria.'); return; }
    const slug = toSlug(nome);
    try {
      await createF.mutateAsync({ nome, slug, descricao: descricao || '', categoria_id: catId, ordem: nextOrdem, ativo: true, video_url: videoUrl || undefined });
      toast.success('Ferramenta criada.');
      onClose();
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao criar ferramenta.'); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/40">
          <DialogTitle className="text-[15px] font-semibold">Nova Ferramenta</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categoria *</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
              <SelectContent>{categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome *</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Diagnóstico Comercial da Clínica" className="h-9 text-sm" autoFocus />
            {nome && <p className="text-[11px] text-muted-foreground/50">Slug: <span className="font-mono">{toSlug(nome)}</span></p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição curta</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Breve descrição da ferramenta..." className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">URL do Vídeo</Label>
            <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." className="h-9 text-sm" />
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button variant="ghost" onClick={onClose} className="h-9 text-sm">Cancelar</Button>
          <Button onClick={handleSave} disabled={createF.isPending}
            className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5">
            {createF.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Criar ferramenta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ferramenta Edit Modal ────────────────────────────────────────────────────

interface FerramEditModalProps {
  open: boolean;
  onClose: () => void;
  ferramenta: AdminFerramenta | null;
}

function FerramEditModal({ open, onClose, ferramenta }: FerramEditModalProps) {
  const updateF = useUpdateFerramenta();
  const [nome, setNome] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (open && ferramenta) {
      setNome(ferramenta.nome ?? '');
      setVideoUrl(ferramenta.video_url ?? '');
      setDescricao(ferramenta.descricao ?? '');
      setAtivo(ferramenta.ativo);
    }
  }, [open, ferramenta]);

  const handleSave = async () => {
    if (!ferramenta) return;
    try {
      await updateF.mutateAsync({
        id: ferramenta.id,
        nome: nome.trim() || ferramenta.nome,
        video_url: videoUrl || null,
        descricao: descricao || '',
        ativo,
      });
      toast.success('Ferramenta atualizada.');
      onClose();
    } catch { toast.error('Erro ao salvar.'); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-[15px] font-semibold">{ferramenta?.nome}</DialogTitle>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${slugColors(ferramenta?.arsenal_categorias?.slug).badge} ${slugColors(ferramenta?.arsenal_categorias?.slug).text}`}>
              {ferramenta?.arsenal_categorias?.nome}
            </span>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[75vh]">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome da ferramenta</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da ferramenta..." className="h-9 text-sm font-semibold" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição curta</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição da ferramenta..." className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Video className="h-3 w-3" /> URL do Vídeo (YouTube)
            </Label>
            <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="h-9 text-sm font-mono text-xs" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Switch checked={ativo} onCheckedChange={setAtivo} />
            <span className="text-sm text-muted-foreground">Ferramenta ativa</span>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button variant="ghost" onClick={onClose} className="h-9 text-sm">Cancelar</Button>
          <Button onClick={handleSave} disabled={updateF.isPending}
            className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5">
            {updateF.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type Tab = 'ferramentas' | 'materiais' | 'templates' | 'aulas';

export default function AdminArsenal() {
  const { data: categorias = [] } = useAdminCategorias();
  const { data: ferramentas = [], isLoading: ferrLoading } = useAdminFerramentas();
  const { data: materiais = [], isLoading: matLoading } = useAdminArsenalMateriais();
  const { data: templates = [], isLoading: tmplLoading } = useAdminArsenalTemplates();
  const deleteFerr = useDeleteFerramenta();
  const deleteM = useDeleteArsenalMaterial();
  const deleteT = useDeleteArsenalTemplate();
  const deleteCat = useDeleteCategoria();

  const [tab, setTab] = useState<Tab>('ferramentas');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedFerrId, setSelectedFerrId] = useState<string | null>(null);
  const [ferrFilter, setFerrFilter] = useState('todos');
  const [tmplFilter, setTmplFilter] = useState('todos');

  // Modais
  const [editingCat, setEditingCat] = useState<AdminCategoria | null>(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [novaFerrOpen, setNovaFerrOpen] = useState(false);
  const [editingFerr, setEditingFerr] = useState<AdminFerramenta | null>(null);
  const [editingMat, setEditingMat] = useState<Partial<AdminArsenalMaterial> | null>(null);
  const [editingTmpl, setEditingTmpl] = useState<Partial<AdminArsenalTemplate> | null>(null);
  const [deletingId, setDeletingId] = useState<{ id: string; type: 'mat' | 'tmpl' | 'ferr' | 'cat'; label?: string } | null>(null);



  // Ferramentas agrupadas por categoria
  const byCategoria = useMemo(() => {
    const map = new Map<string, { cat: AdminFerramenta['arsenal_categorias']; ferramentas: AdminFerramenta[] }>();
    for (const f of ferramentas) {
      const catId = f.arsenal_categorias?.id;
      if (!catId) continue;
      if (!map.has(catId)) map.set(catId, { cat: f.arsenal_categorias, ferramentas: [] });
      map.get(catId)!.ferramentas.push(f);
    }
    return Array.from(map.values()).sort((a, b) => (a.cat?.ordem ?? 0) - (b.cat?.ordem ?? 0));
  }, [ferramentas]);

  const filteredMat = ferrFilter === 'todos' ? materiais : materiais.filter(m => m.ferramenta_id === ferrFilter);
  const filteredTmpl = tmplFilter === 'todos' ? templates : templates.filter(t => t.ferramenta_id === tmplFilter);

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    const { id, type } = deletingId;
    setDeletingId(null);
    try {
      if (type === 'mat')  { await deleteM.mutateAsync(id);    toast.success('Material excluído.'); }
      else if (type === 'tmpl') { await deleteT.mutateAsync(id); toast.success('Template excluído.'); }
      else if (type === 'ferr') { await deleteFerr.mutateAsync(id); toast.success('Ferramenta excluída.'); }
      else if (type === 'cat')  { await deleteCat.mutateAsync(id);  toast.success('Categoria excluída.'); }
    } catch { toast.error('Erro ao excluir.'); }
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'ferramentas', label: 'Ferramentas', icon: Swords,         count: ferramentas.length },
    { id: 'materiais',  label: 'Materiais',    icon: FileText,       count: materiais.length },
    { id: 'templates',  label: 'Templates',    icon: LayoutTemplate, count: templates.length },
    { id: 'aulas',      label: 'Aulas',        icon: BookOpen,       count: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-muted"><Swords className="h-4 w-4 text-muted-foreground" /></div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Arsenal Comercial</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">Gerencie ferramentas, materiais de apoio e templates de documentos</p>
      </div>

      {/* ─── Stats ─── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Ferramentas', value: ferramentas.length, sub: `${ferramentas.filter(f => f.ativo).length} ativas`, icon: Swords },
          { label: 'Materiais de Apoio', value: materiais.length, sub: `${materiais.filter(m => m.tipo === 'pdf').length} PDF · ${materiais.filter(m => m.tipo === 'html').length} HTML`, icon: FileText },
          { label: 'Templates', value: templates.length, sub: `${templates.filter(t => t.ativo).length} ativos`, icon: LayoutTemplate },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1.5 rounded-lg bg-muted"><s.icon className="h-3.5 w-3.5 text-muted-foreground" /></span>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
            </div>
            <p className="text-3xl font-bold font-display text-foreground">{s.value}</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all ${tab === t.id ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label} {t.count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.id ? 'bg-background/20' : 'bg-muted'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ─── Ferramentas ─── */}
      {tab === 'ferramentas' && (
        <div className="space-y-3">
          {/* Barra de ações */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground/60">{ferramentas.length} ferramentas em {byCategoria.length} categorias</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => { setEditingCat(null); setCatModalOpen(true); }}
                className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3">
                <Plus className="h-3.5 w-3.5" /> Nova Categoria
              </Button>
              <Button onClick={() => setNovaFerrOpen(true)}
                className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-3 gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Nova Ferramenta
              </Button>
            </div>
          </div>

          {ferrLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            byCategoria.map(({ cat, ferramentas: ferrList }) => {
              const catFromCategorias = categorias.find(c2 => c2.id === cat?.id);
              const catCorStr = catFromCategorias?.cor ?? null;
              const catCorObj = catCorStr ? CAT_COLORS.find(x => x.value === catCorStr) : null;
              const dotClass = catCorObj ? catCorObj.tw : slugColors(cat?.slug).dot;
              // Build full AdminCategoria with fallback to joined data
              const catObj: AdminCategoria | null = cat ? {
                id: cat.id,
                nome: catFromCategorias?.nome ?? cat.nome,
                slug: catFromCategorias?.slug ?? cat.slug,
                ordem: catFromCategorias?.ordem ?? cat.ordem,
                cor: catFromCategorias?.cor ?? null,
              } : null;
              return (
                <div key={cat?.id}
                  className="group rounded-2xl border border-border/60 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-border hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedCatId(cat?.id ?? null)}
                >
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
                      <span className="text-[13px] font-semibold text-foreground">{cat?.nome}</span>
                      <span className="text-[11px] text-muted-foreground/60">{ferrList.length} ferramenta{ferrList.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1 ml-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditingCat(catObj); setCatModalOpen(true); }}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Editar categoria">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground/50" />
                        </button>
                        <button onClick={() => setDeletingId({ id: cat?.id ?? '', type: 'cat', label: cat?.nome })}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Excluir categoria">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-destructive" />
                        </button>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  </div>

                  {/* Preview das ferramentas */}
                  {ferrList.length > 0 && (
                    <div className="px-5 pb-3.5 flex items-center gap-1.5 flex-wrap">
                      {ferrList.slice(0, 5).map(f => (
                        <span key={f.id} className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full border font-medium',
                          f.ativo ? 'bg-muted/40 border-border/40 text-muted-foreground/70' : 'bg-muted/20 border-border/30 text-muted-foreground/40 line-through'
                        )}>
                          {f.nome}
                        </span>
                      ))}
                      {ferrList.length > 5 && (
                        <span className="text-[10px] text-muted-foreground/40">+{ferrList.length - 5} mais</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── Materiais ─── */}
      {tab === 'materiais' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Select value={ferrFilter} onValueChange={setFerrFilter}>
              <SelectTrigger className="h-9 w-72 text-sm"><SelectValue placeholder="Filtrar por ferramenta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as ferramentas</SelectItem>
                {ferramentas.map(f => <SelectItem key={f.id} value={f.id}>{f.arsenal_categorias?.nome} — {f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setEditingMat({})}
              className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Novo Material
            </Button>
          </div>

          {matLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredMat.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border/60">
              <FileText className="h-7 w-7 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum material cadastrado</p>
              <p className="text-[12px] text-muted-foreground/50 mt-0.5">Adicione PDFs ou conteúdos HTML por ferramenta</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              {filteredMat.map((m, i) => {
                const c = slugColors((m.arsenal_ferramentas as any)?.arsenal_categorias?.slug);
                return (
                  <div key={m.id}
                    className={`group flex items-center justify-between px-5 py-3.5 ${i < filteredMat.length - 1 ? 'border-b border-border/30' : ''} hover:bg-muted/10`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 rounded-lg ${m.tipo === 'pdf' ? 'bg-red-50' : 'bg-blue-50'}`}>
                        {m.tipo === 'pdf' ? <FileText className="h-3.5 w-3.5 text-red-500" /> : <Code className="h-3.5 w-3.5 text-blue-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">{m.titulo}</p>
                        <p className="text-[11px] text-muted-foreground/60">
                          {(m.arsenal_ferramentas as any)?.nome}
                          {!m.ativo && ' · Inativo'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {m.pdf_url && (
                        <a href={m.pdf_url} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Ver PDF">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      )}
                      <button onClick={() => setEditingMat(m)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => setDeletingId({ id: m.id, type: 'mat' })} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Templates ─── */}
      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Select value={tmplFilter} onValueChange={setTmplFilter}>
              <SelectTrigger className="h-9 w-72 text-sm"><SelectValue placeholder="Filtrar por ferramenta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as ferramentas</SelectItem>
                {ferramentas.map(f => <SelectItem key={f.id} value={f.id}>{f.arsenal_categorias?.nome} — {f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setEditingTmpl({})}
              className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Novo Template
            </Button>
          </div>

          {tmplLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredTmpl.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-border/60">
              <LayoutTemplate className="h-7 w-7 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum template cadastrado</p>
              <p className="text-[12px] text-muted-foreground/50 mt-0.5">Crie templates para ajudar os clientes a estruturar seus documentos</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTmpl.map(t => {
                const c = slugColors(t.arsenal_categorias?.slug ?? t.arsenal_ferramentas?.arsenal_categorias?.slug);
                return (
                  <div key={t.id} className="group relative rounded-2xl border border-border/60 bg-card overflow-hidden hover:border-border hover:shadow-md transition-all">
                    <div className={`h-1 w-full ${c.dot}`} />
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.badge} ${c.text}`}>
                          {t.arsenal_categorias?.nome ?? t.arsenal_ferramentas?.arsenal_categorias?.nome}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
                          {t.arsenal_ferramentas?.nome}
                        </span>
                      </div>
                      <h3 className="text-[13px] font-semibold text-foreground mb-1">{t.titulo}</h3>
                      {t.descricao && <p className="text-[11px] text-muted-foreground line-clamp-2">{t.descricao}</p>}
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
                      {!t.ativo && <span className="text-[10px] text-muted-foreground/50">Inativo</span>}
                      <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingTmpl(t)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeletingId({ id: t.id, type: 'tmpl' })} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Categoria Detail Dialog ─── */}
      {(() => {
        const entry = byCategoria.find(e => e.cat?.id === selectedCatId);
        const catFromCategorias = selectedCatId ? categorias.find(c => c.id === selectedCatId) : undefined;
        const catFromEntry = entry?.cat ?? null;
        const catObj: AdminCategoria | null = selectedCatId ? {
          id: selectedCatId,
          nome: catFromCategorias?.nome ?? catFromEntry?.nome ?? '',
          slug: catFromCategorias?.slug ?? catFromEntry?.slug ?? '',
          ordem: catFromCategorias?.ordem ?? catFromEntry?.ordem ?? 0,
          cor: catFromCategorias?.cor ?? null,
        } : null;
        return (
          <CategoriaDetailDialog
            open={!!selectedCatId}
            cat={catObj}
            ferramentas={entry?.ferramentas ?? []}
            onClose={() => setSelectedCatId(null)}
            onEdit={() => { setEditingCat(catObj); setCatModalOpen(true); setSelectedCatId(null); }}
            onDelete={() => { setDeletingId({ id: selectedCatId!, type: 'cat', label: catObj?.nome }); setSelectedCatId(null); }}
            onEditFerr={f => { setEditingFerr(f); }}
            onDeleteFerr={(id, nome) => { setDeletingId({ id, type: 'ferr', label: nome }); setSelectedCatId(null); }}
            onAddFerr={() => { setNovaFerrOpen(true); setSelectedCatId(null); }}
            onOpenFerr={f => { setSelectedFerrId(f.id); }}
          />
        );
      })()}

      {/* ─── Ferramenta Detail Dialog ─── */}
      {(() => {
        const ferr = ferramentas.find(f => f.id === selectedFerrId) ?? null;
        const ferrMateriais = materiais.filter(m => m.ferramenta_id === selectedFerrId);
        const ferrTemplates = templates.filter(t => t.ferramenta_id === selectedFerrId);
        return (
          <FerramentaDetailDialog
            open={!!selectedFerrId}
            ferramenta={ferr}
            materiais={ferrMateriais}
            templates={ferrTemplates}
            onClose={() => setSelectedFerrId(null)}
            onAddMaterial={() => { setEditingMat({ ferramenta_id: selectedFerrId ?? undefined }); }}
            onAddTemplate={() => { setEditingTmpl({ ferramenta_id: selectedFerrId ?? undefined }); }}
            onEditMaterial={m => { setEditingMat(m); }}
            onEditTemplate={t => { setEditingTmpl(t); }}
            onDeleteMaterial={(id, titulo) => setDeletingId({ id, type: 'mat', label: titulo })}
            onDeleteTemplate={(id, titulo) => setDeletingId({ id, type: 'tmpl', label: titulo })}
          />
        );
      })()}

      {/* ─── Modais ─── */}
      <CategoriaModal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        categoria={editingCat}
        nextOrdem={categorias.length + 1}
      />
      <NovaFerramentaModal
        open={novaFerrOpen}
        onClose={() => setNovaFerrOpen(false)}
        categorias={categorias}
        nextOrdem={ferramentas.length + 1}
      />
      <FerramEditModal
        open={!!editingFerr}
        onClose={() => setEditingFerr(null)}
        ferramenta={editingFerr}
      />
      <MaterialModal
        open={editingMat !== null}
        onClose={() => setEditingMat(null)}
        material={editingMat}
        ferramentas={ferramentas}
      />
      <TemplateModal
        open={editingTmpl !== null}
        onClose={() => setEditingTmpl(null)}
        template={editingTmpl}
        ferramentas={ferramentas}
      />

      {/* ─── Aulas ─── */}
      {tab === 'aulas' && <AdminArsenalAulas />}

      {/* ─── Confirmar exclusão ─── */}
      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingId?.label ? (
                <>Tem certeza que deseja excluir <strong>"{deletingId.label}"</strong>? Esta ação não pode ser desfeita.</>
              ) : 'Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
