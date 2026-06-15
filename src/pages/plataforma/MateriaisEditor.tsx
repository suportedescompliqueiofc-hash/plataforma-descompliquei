import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import { ArrowLeft, Save, Loader2, BookMarked, Check, Link2, X, Search, ChevronDown, Pencil, ScanText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useDocumento, useUpdateDocumento, useAssociarFerramenta } from '@/hooks/useMeusMateriais';
import { getRichExtensions, RichToolbar, EDITOR_STYLES } from '@/components/editor/RichEditor';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FerramentaOption {
  id: string;
  nome: string;
  categoria_id: string;
  categoria_nome: string;
}

function useFerramentasArsenal() {
  return useQuery({
    queryKey: ['arsenal-ferramentas-lista'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('arsenal_ferramentas')
        .select('id, nome, categoria_id, arsenal_categorias(nome)')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data ?? []).map((f: any) => ({
        id: f.id,
        nome: f.nome,
        categoria_id: f.categoria_id,
        categoria_nome: f.arsenal_categorias?.nome ?? '',
      })) as FerramentaOption[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved';

function markdownToHtml(md: string): string {
  if (!md) return '';
  // If content already has HTML tags, return as-is
  if (/<[a-z][\s\S]*>/i.test(md)) return md;

  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      if (inList) { out.push('</ul>'); inList = false; }
      continue;
    }

    // headings
    const h = line.match(/^(#{1,4})\s+(.+)/);
    if (h) {
      if (inList) { out.push('</ul>'); inList = false; }
      const lvl = Math.min(h[1].length, 4);
      out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      continue;
    }

    // list items
    const li = line.match(/^[-*•]\s+(.+)/);
    if (li) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }

    // horizontal rule
    if (/^[-*_]{3,}$/.test(line)) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('<hr>');
      continue;
    }

    // paragraph
    if (inList) { out.push('</ul>'); inList = false; }
    out.push(`<p>${inline(line)}</p>`);
  }

  if (inList) out.push('</ul>');
  return out.join('\n');
}

export default function MateriaisEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data: doc, isLoading } = useDocumento(id);
  const updateDoc = useUpdateDocumento();
  const associar = useAssociarFerramenta();
  const { data: ferramentas = [] } = useFerramentasArsenal();
  const [assocOpen, setAssocOpen] = useState(false);
  const [assocSearch, setAssocSearch] = useState('');
  const [viewMode, setViewMode] = useState(() => searchParams.get('view') === '1');

  const [title, setTitle] = useState('Sem título');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const initialized = useRef(false);
  const isDirty = useRef(false);
  const latestTitle = useRef(title);
  const latestContent = useRef('');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: getRichExtensions(),
    content: '',
    editorProps: {
      attributes: { class: 'outline-none min-h-[400px] cursor-text' },
    },
    onUpdate: ({ editor }) => {
      if (!initialized.current) return;
      latestContent.current = editor.getHTML();
      isDirty.current = true;
      setSaveStatus('dirty');
      scheduleAutoSave();
    },
  });

  useEffect(() => {
    if (doc && editor && !initialized.current) {
      setTitle(doc.titulo || 'Sem título');
      latestTitle.current = doc.titulo || 'Sem título';
      editor.commands.setContent(doc.conteudo || '');
      latestContent.current = doc.conteudo || '';
      initialized.current = true;
      setSaveStatus('idle');
      // Force view mode for diagnóstico docs when ?view=1
      if (doc.categoria === 'diagnostico' && searchParams.get('view') === '1') {
        setViewMode(true);
      }
    }
  }, [doc, editor, searchParams]);

  const doSave = useCallback(async () => {
    if (!id) return;
    setSaveStatus('saving');
    isDirty.current = false;
    try {
      await updateDoc.mutateAsync({ id, titulo: latestTitle.current, conteudo: latestContent.current });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      isDirty.current = true;
      setSaveStatus('dirty');
      toast.error('Erro ao salvar. Tente novamente.');
    }
  }, [id]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(doSave, 30000);
  }, [doSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (isDirty.current && id)
        updateDoc.mutate({ id, titulo: latestTitle.current, conteudo: latestContent.current });
    };
  }, [id]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    latestTitle.current = e.target.value;
    if (initialized.current) {
      isDirty.current = true;
      setSaveStatus('dirty');
      scheduleAutoSave();
    }
  };

  const handleSave = async () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    await doSave();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Documento não encontrado.</p>
        <Button variant="ghost" onClick={() => navigate('/plataforma/materiais')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const ferrNome = doc.arsenal_ferramentas?.nome;
  const catNome  = doc.arsenal_categorias?.nome;

  const filteredFerramentas = ferramentas.filter(f =>
    !assocSearch || f.nome.toLowerCase().includes(assocSearch.toLowerCase()) || f.categoria_nome.toLowerCase().includes(assocSearch.toLowerCase())
  );
  const grouped = filteredFerramentas.reduce<Record<string, FerramentaOption[]>>((acc, f) => {
    if (!acc[f.categoria_nome]) acc[f.categoria_nome] = [];
    acc[f.categoria_nome].push(f);
    return acc;
  }, {});

  // ─── View mode (read-only) for diagnóstico docs ───
  if (viewMode && doc) {
    return (
      <div className="max-w-3xl mx-auto space-y-0">
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden mb-6">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
            <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Link to="/plataforma/materiais" className="hover:text-foreground transition-colors flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Meus Materiais
              </Link>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-foreground/70 truncate max-w-[200px]">{doc.titulo || 'Sem título'}</span>
            </nav>
            <Button
              onClick={() => setViewMode(false)}
              className="h-8 rounded-lg text-[11px] font-semibold border border-border/60 bg-background hover:bg-muted/50 text-foreground px-3 gap-1.5"
              variant="outline"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          </div>

          <div className="px-8 pt-6 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                <ScanText className="h-3 w-3" /> Base
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">{doc.titulo || 'Sem título'}</h1>
          </div>
        </div>

        <div
          className={cn(
            'rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-8 py-8',
            EDITOR_STYLES,
          )}
          dangerouslySetInnerHTML={{ __html: markdownToHtml(doc.conteudo || '') }}
        />
      </div>
    );
  }

  const handleAssociar = async (ferr: FerramentaOption | null) => {
    if (!id) return;
    await associar.mutateAsync({ id, ferramenta_id: ferr?.id ?? null, categoria_arsenal_id: ferr?.categoria_id ?? null });
    toast.success(ferr ? `Associado a "${ferr.nome}"` : 'Associação removida');
    setAssocOpen(false);
    setAssocSearch('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-0">
      {/* ─── Header card ─── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden mb-6">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
          <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Link to="/plataforma/materiais" className="hover:text-foreground transition-colors flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Meus Materiais
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground/70 truncate max-w-[200px]">{title || 'Sem título'}</span>
          </nav>

          <div className="flex items-center gap-3">
            <span className={cn(
              'text-[11px] transition-opacity',
              saveStatus === 'idle' ? 'opacity-0' :
              saveStatus === 'dirty' ? 'text-muted-foreground/50 opacity-100' :
              saveStatus === 'saving' ? 'text-muted-foreground opacity-100' :
              'text-emerald-500 opacity-100'
            )}>
              {saveStatus === 'dirty' && 'Não salvo'}
              {saveStatus === 'saving' && 'Salvando...'}
              {saveStatus === 'saved' && <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Salvo</span>}
            </span>
            <Button
              onClick={handleSave}
              disabled={updateDoc.isPending || saveStatus === 'saving' || saveStatus === 'idle'}
              className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-3 gap-1.5 disabled:opacity-40"
            >
              {updateDoc.isPending || saveStatus === 'saving'
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Save className="h-3.5 w-3.5" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Title */}
        <div className="px-8 pt-8 pb-4">
          {/* Arsenal association */}
          <div className="flex items-center gap-2 mb-4">
            <Popover open={assocOpen} onOpenChange={setAssocOpen}>
              <PopoverTrigger asChild>
                <button className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  ferrNome
                    ? 'border-border/60 bg-muted/40 text-foreground/70 hover:bg-muted/60'
                    : 'border-dashed border-border/50 text-muted-foreground/50 hover:text-muted-foreground hover:border-border/70 bg-transparent'
                )}>
                  {ferrNome ? (
                    <>
                      <BookMarked className="h-3 w-3 text-muted-foreground/50" />
                      <span className="max-w-[180px] truncate">{ferrNome}</span>
                      {catNome && <span className="text-muted-foreground/40">· {catNome}</span>}
                      <ChevronDown className="h-3 w-3 text-muted-foreground/40 ml-0.5" />
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3 w-3" />
                      Associar à ferramenta do Arsenal
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 rounded-xl border-border/60 shadow-lg" align="start">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
                  <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <input
                    autoFocus
                    value={assocSearch}
                    onChange={e => setAssocSearch(e.target.value)}
                    placeholder="Pesquisar ferramenta..."
                    className="flex-1 text-[12px] bg-transparent outline-none placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {ferrNome && (
                    <button
                      onClick={() => handleAssociar(null)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                    >
                      <X className="h-3 w-3" /> Remover associação
                    </button>
                  )}
                  {Object.entries(grouped).map(([cat, items]) => (
                    <div key={cat}>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{cat}</p>
                      {items.map(f => (
                        <button
                          key={f.id}
                          onClick={() => handleAssociar(f)}
                          className={cn(
                            'w-full text-left px-3 py-1.5 text-[12px] hover:bg-muted/50 transition-colors',
                            doc.ferramenta_id === f.id ? 'text-foreground font-medium' : 'text-foreground/70'
                          )}
                        >
                          {doc.ferramenta_id === f.id && <Check className="h-3 w-3 inline mr-1.5 text-emerald-500" />}
                          {f.nome}
                        </button>
                      ))}
                    </div>
                  ))}
                  {filteredFerramentas.length === 0 && (
                    <p className="px-3 py-4 text-center text-[11px] text-muted-foreground/50">Nenhuma ferramenta encontrada</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Sem título"
            className="w-full text-3xl font-bold tracking-tight text-foreground font-display bg-transparent border-none outline-none placeholder:text-muted-foreground/30 leading-tight"
          />
        </div>

        {/* Toolbar */}
        <div className="border-t border-border/40 bg-muted/[0.02]">
          <RichToolbar editor={editor} />
        </div>
      </div>

      {/* ─── Editor ─── */}
      <div
        className={cn(
          'rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-8 py-8',
          EDITOR_STYLES,
          '[&_.ProseMirror]:min-h-[400px]',
        )}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
