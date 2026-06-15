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
        <DialogHeader className="px-6 py-4 border-b border-border/40">
          <DialogTitle className="text-[15px] font-semibold">
            {isEdit ? 'Editar Template' : 'Novo Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[75vh] px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Nome do template" className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
              <Select value={catFilter} onValueChange={handleSelectCat}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
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
                  {ferraBycat.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição (opcional)</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Explique brevemente o que este template ajuda a construir..." rows={2} className="text-sm resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conteúdo do Template</Label>
            <div className="rounded-xl border border-border/60 overflow-hidden">
              {/* Toolbar */}
              <div className="border-b border-border/40 bg-muted/[0.02]">
                <RichToolbar editor={editor} compact />
              </div>
              {/* Editor */}
              <div
                className={cn('px-5 py-4 bg-card cursor-text', EDITOR_STYLES, '[&_.ProseMirror]:min-h-[200px]')}
                onClick={() => editor?.commands.focus()}
              >
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ordem</Label>
              <Input type="number" value={ordem} onChange={e => setOrdem(Number(e.target.value))} className="h-9 w-24 text-sm" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <span className="text-sm text-muted-foreground">Ativo</span>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button variant="ghost" onClick={onClose} className="h-9 text-sm">Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={createT.isPending || updateT.isPending}
            className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5"
          >
            {(createT.isPending || updateT.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isEdit ? 'Salvar alterações' : 'Criar template'}
          </Button>
        </DialogFooter>
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
        <DialogHeader className="px-6 py-4 border-b border-border/40">
          <DialogTitle className="text-[15px] font-semibold">{isEdit ? 'Editar Material' : 'Novo Material'}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-4">
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
              <Select value={ferrId} onValueChange={setFerrId} disabled={ferraBycat.length === 0}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={catFilter ? 'Selecionar ferramenta' : 'Selecione a categoria primeiro'} /></SelectTrigger>
                <SelectContent>
                  {ferraBycat.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Nome do material" className="h-9 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</Label>
            <div className="flex gap-2">
              {(['pdf', 'html'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-[13px] font-medium transition-all ${tipo === t ? 'border-foreground/30 bg-foreground/[0.04]' : 'border-border/60 hover:border-border'}`}
                >
                  {t === 'pdf' ? <FileText className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {tipo === 'pdf' ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Arquivo PDF *</Label>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
              {pdfFile ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20">
                  <div className="p-2 rounded-lg bg-red-50"><File className="h-4 w-4 text-red-500" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{pdfFile.name}</p>
                    <p className="text-[11px] text-muted-foreground/60">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : pdfUrl ? (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20">
                  <div className="p-2 rounded-lg bg-red-50"><File className="h-4 w-4 text-red-500" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground">PDF já enviado</p>
                    <p className="text-[11px] text-muted-foreground/60 truncate">{pdfUrl}</p>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors">
                    Trocar
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border/60 hover:border-foreground/20 hover:bg-muted/20 transition-all text-muted-foreground">
                  <Upload className="h-6 w-6 opacity-40" />
                  <div className="text-center">
                    <p className="text-[13px] font-medium">Clique para selecionar o PDF</p>
                    <p className="text-[11px] opacity-60 mt-0.5">Máximo 50 MB</p>
                  </div>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conteúdo HTML</Label>
              <Textarea value={htmlContent} onChange={e => setHtmlContent(e.target.value)} placeholder="<html>...</html>" rows={8} className="text-sm font-mono text-xs resize-none" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch checked={ativo} onCheckedChange={setAtivo} />
            <span className="text-sm text-muted-foreground">Ativo</span>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button variant="ghost" onClick={onClose} disabled={isSaving} className="h-9 text-sm">Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}
            className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {uploading ? 'Enviando PDF...' : isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
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

function CategoriaModal({ open, onClose, categoria, nextOrdem }: CategoriaModalProps) {
  const createC = useCreateCategoria();
  const updateC = useUpdateCategoria();
  const isEdit = !!categoria?.id;

  const [nome, setNome] = useState('');

  useEffect(() => {
    if (open && categoria) { setNome(categoria.nome); }
    else if (open && !categoria) { setNome(''); }
  }, [open, categoria]);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error('Informe o nome da categoria.'); return; }
    const slug = toSlug(nome);
    try {
      if (isEdit && categoria?.id) {
        await updateC.mutateAsync({ id: categoria.id, nome, slug });
        toast.success('Categoria atualizada.');
      } else {
        await createC.mutateAsync({ nome, slug, ordem: nextOrdem });
        toast.success('Categoria criada.');
      }
      onClose();
    } catch (e: any) { toast.error(e?.message ?? 'Erro ao salvar categoria.'); }
  };

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
  const [videoUrl, setVideoUrl] = useState('');
  const [textoAprenda, setTextoAprenda] = useState('');
  const [templateConstrua, setTemplateConstrua] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (open && ferramenta) {
      setVideoUrl(ferramenta.video_url ?? '');
      setTextoAprenda(ferramenta.texto_aprenda ?? '');
      setTemplateConstrua(ferramenta.template_construa ?? '');
      setDescricao(ferramenta.descricao ?? '');
      setAtivo(ferramenta.ativo);
    }
  }, [open, ferramenta]);

  const handleSave = async () => {
    if (!ferramenta) return;
    try {
      await updateF.mutateAsync({
        id: ferramenta.id,
        video_url: videoUrl || null,
        texto_aprenda: textoAprenda || null,
        template_construa: templateConstrua || null,
        descricao: descricao || '',
        ativo,
      });
      toast.success('Ferramenta atualizada.');
      onClose();
    } catch { toast.error('Erro ao salvar.'); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
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
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição curta</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição da ferramenta..." className="h-9 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Video className="h-3 w-3" /> URL do Vídeo (YouTube)
            </Label>
            <Input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="h-9 text-sm font-mono text-xs" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="h-3 w-3" /> Texto — Aba Aprenda
            </Label>
            <Textarea value={textoAprenda} onChange={e => setTextoAprenda(e.target.value)}
              placeholder="Conteúdo conceitual mostrado na aba 'Aprenda' desta ferramenta..."
              rows={5} className="text-sm resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <LayoutTemplate className="h-3 w-3" /> Placeholder da Aba Construa
            </Label>
            <Textarea value={templateConstrua} onChange={e => setTemplateConstrua(e.target.value)}
              placeholder="Texto de placeholder exibido no editor da aba 'Construa' quando está vazio..."
              rows={3} className="text-sm resize-none" />
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

type Tab = 'ferramentas' | 'materiais' | 'templates';

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
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
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

  const toggleCat = (id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Expand all categories by default
  useEffect(() => {
    if (ferramentas.length > 0) {
      const cats = new Set<string>(ferramentas.map(f => f.arsenal_categorias?.id).filter(Boolean));
      setExpandedCats(cats);
    }
  }, [ferramentas.length]);

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
              const c = slugColors(cat?.slug);
              const isExpanded = expandedCats.has(cat?.id ?? '');
              const catObj = categorias.find(c2 => c2.id === cat?.id) ?? null;
              return (
                <div key={cat?.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                  {/* Category header */}
                  <div className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/10 transition-colors">
                    <button onClick={() => toggleCat(cat?.id ?? '')} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
                      <span className="text-[13px] font-semibold text-foreground">{cat?.nome}</span>
                      <span className="text-[11px] text-muted-foreground/60">{ferrList.length} ferramentas</span>
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
                    </button>
                    <div className="flex items-center gap-1 ml-3">
                      <button onClick={() => { setEditingCat(catObj); setCatModalOpen(true); }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Editar categoria">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </button>
                      <button onClick={() => setDeletingId({ id: cat?.id ?? '', type: 'cat', label: cat?.nome })}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Excluir categoria">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-destructive" />
                      </button>
                    </div>
                  </div>

                  {/* Ferramentas list */}
                  {isExpanded && (
                    <div className="border-t border-border/40">
                      {ferrList.map((f, i) => (
                        <div key={f.id}
                          className={`group flex items-center justify-between px-5 py-3 ${i < ferrList.length - 1 ? 'border-b border-border/30' : ''} hover:bg-muted/10 transition-colors`}>
                          <div className="flex items-center gap-3">
                            <span className="text-[13px] font-medium text-foreground">{f.nome}</span>
                            {!f.ativo && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60">Inativo</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {f.video_url && <span title="Tem vídeo" className="p-1 text-muted-foreground/30"><Video className="h-3.5 w-3.5" /></span>}
                            {f.texto_aprenda && <span title="Tem texto" className="p-1 text-muted-foreground/30"><BookOpen className="h-3.5 w-3.5" /></span>}
                            <button onClick={() => setEditingFerr(f)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Editar">
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => setDeletingId({ id: f.id, type: 'ferr', label: f.nome })}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Excluir">
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {/* Linha para adicionar ferramenta nessa categoria */}
                      <button onClick={() => setNovaFerrOpen(true)}
                        className="w-full flex items-center gap-2 px-5 py-2.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/10 transition-colors border-t border-dashed border-border/30">
                        <Plus className="h-3.5 w-3.5" /> Adicionar ferramenta
                      </button>
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
