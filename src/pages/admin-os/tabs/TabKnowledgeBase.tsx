import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BookOpen, Plus, Search, Pencil, Trash2, Eye, EyeOff, Loader2,
  Rocket, Users, MessageSquare, Bot, Calendar, BarChart2, X, Save,
  ChevronLeft, Tag,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useAdminKbCategorias, useAdminKbArtigos,
  useSalvarArtigo, useToggleArtigo, useExcluirArtigo,
  type KbArtigo, type KbCategoria,
} from '@/hooks/useKbArtigos';

// ── Icon map ──────────────────────────────────────────────────────────────────

const CATEGORIA_ICONS: Record<string, React.ReactNode> = {
  Rocket: <Rocket className="h-3.5 w-3.5" />,
  Users: <Users className="h-3.5 w-3.5" />,
  MessageSquare: <MessageSquare className="h-3.5 w-3.5" />,
  Bot: <Bot className="h-3.5 w-3.5" />,
  Calendar: <Calendar className="h-3.5 w-3.5" />,
  BarChart2: <BarChart2 className="h-3.5 w-3.5" />,
  BookOpen: <BookOpen className="h-3.5 w-3.5" />,
};

function CatIcon({ icone, className }: { icone: string; className?: string }) {
  return (
    <span className={className}>
      {CATEGORIA_ICONS[icone] ?? <BookOpen className="h-3.5 w-3.5" />}
    </span>
  );
}

// ── Markdown preview simples ───────────────────────────────────────────────────

function ArticleContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
          : part
      )}
    </div>
  );
}

// ── Modal de artigo ───────────────────────────────────────────────────────────

function ArtigoModal({
  artigo,
  categorias,
  onClose,
}: {
  artigo: Partial<KbArtigo> | null;
  categorias: KbCategoria[];
  onClose: () => void;
}) {
  const salvar = useSalvarArtigo();
  const isEdit = !!artigo?.id;

  const [titulo, setTitulo] = useState(artigo?.titulo ?? '');
  const [categoriaId, setCategoriaId] = useState(artigo?.categoria_id ?? (categorias[0]?.id ?? ''));
  const [conteudo, setConteudo] = useState(artigo?.conteudo ?? '');
  const [tagsInput, setTagsInput] = useState((artigo?.tags ?? []).join(', '));
  const [preview, setPreview] = useState(false);

  const handleSalvar = async () => {
    if (!titulo.trim() || !conteudo.trim()) return;
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    await salvar.mutateAsync({
      id: artigo?.id,
      titulo,
      categoria_id: categoriaId || null,
      conteudo,
      tags,
    });
    toast.success(isEdit ? 'Artigo atualizado' : 'Artigo criado');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl bg-card rounded-2xl border border-border/60 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {isEdit ? 'Editar Artigo' : 'Novo Artigo'}
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Base de Conhecimento</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreview(p => !p)}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium transition-all border',
                preview
                  ? 'bg-foreground text-background border-foreground'
                  : 'text-muted-foreground border-border/60 hover:text-foreground'
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              {preview ? 'Editando' : 'Preview'}
            </button>
            <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Título</Label>
              <Input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Como adicionar um novo lead?"
                className="h-10 text-sm rounded-lg border-border/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conteúdo</Label>
              <span className="text-[10px] text-muted-foreground/40">Use **negrito** para destacar trechos</span>
            </div>
            {preview ? (
              <div className="min-h-[280px] rounded-xl border border-border/60 bg-muted/[0.02] p-4">
                <ArticleContent content={conteudo} />
              </div>
            ) : (
              <Textarea
                value={conteudo}
                onChange={e => setConteudo(e.target.value)}
                placeholder="Escreva o conteúdo do artigo. Use **negrito** para destacar termos importantes e linhas em branco para separar seções."
                className="min-h-[280px] text-sm rounded-xl border-border/60 resize-none font-mono text-[13px] leading-relaxed"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tags <span className="normal-case font-normal text-muted-foreground/40">(separadas por vírgula)</span>
            </Label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <Input
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="lead, cadastro, pipeline, whatsapp..."
                className="pl-9 h-10 text-sm rounded-lg border-border/60"
              />
            </div>
            {tagsInput && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tagsInput.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/40 bg-muted/20 shrink-0">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
          <Button
            onClick={handleSalvar}
            disabled={!titulo.trim() || !conteudo.trim() || salvar.isPending}
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
          >
            {salvar.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</> : <><Save className="h-3.5 w-3.5" /> Salvar Artigo</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Detalhe do artigo (admin preview) ────────────────────────────────────────

function ArtigoDetalhe({ artigo, onBack, onEdit }: { artigo: KbArtigo; onBack: () => void; onEdit: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Voltar para lista
        </button>
        <Button
          onClick={onEdit}
          className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-3 gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </Button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2 mb-2">
            {artigo.kb_categorias && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                <CatIcon icone={artigo.kb_categorias.icone} />
                {artigo.kb_categorias.nome}
              </span>
            )}
            {!artigo.ativo && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-semibold border border-amber-200">
                Rascunho
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-foreground font-display">{artigo.titulo}</h2>
          <p className="text-[11px] text-muted-foreground/50 mt-1">
            Atualizado em {format(parseISO(artigo.updated_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="p-5">
          <ArticleContent content={artigo.conteudo} />
        </div>
        {artigo.tags && artigo.tags.length > 0 && (
          <div className="px-5 py-3 border-t border-border/30 bg-muted/[0.02] flex items-center gap-2 flex-wrap">
            <Tag className="h-3 w-3 text-muted-foreground/30 shrink-0" />
            {artigo.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TabKnowledgeBase() {
  const { data: categorias = [] } = useAdminKbCategorias();
  const { data: artigos = [], isLoading } = useAdminKbArtigos();
  const toggleArtigo = useToggleArtigo();
  const excluirArtigo = useExcluirArtigo();

  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [modalArtigo, setModalArtigo] = useState<Partial<KbArtigo> | null | false>(false);
  const [artigoDetalhe, setArtigoDetalhe] = useState<KbArtigo | null>(null);

  const artigosFiltrados = artigos.filter(a => {
    if (filtroCategoria !== 'todos' && a.categoria_id !== filtroCategoria) return false;
    if (!busca) return true;
    const q = busca.toLowerCase();
    return a.titulo.toLowerCase().includes(q) || a.conteudo.toLowerCase().includes(q) || a.tags.some(t => t.includes(q));
  });

  const handleExcluir = async (id: string, titulo: string) => {
    if (!confirm(`Excluir "${titulo}"? Esta ação não pode ser desfeita.`)) return;
    await excluirArtigo.mutateAsync(id);
    toast.success('Artigo excluído');
    if (artigoDetalhe?.id === id) setArtigoDetalhe(null);
  };

  if (artigoDetalhe) {
    return (
      <>
        {modalArtigo !== false && (
          <ArtigoModal
            artigo={modalArtigo}
            categorias={categorias}
            onClose={() => {
              setModalArtigo(false);
              setArtigoDetalhe(null);
            }}
          />
        )}
        <ArtigoDetalhe
          artigo={artigoDetalhe}
          onBack={() => setArtigoDetalhe(null)}
          onEdit={() => setModalArtigo(artigoDetalhe)}
        />
      </>
    );
  }

  const totalAtivos = artigos.filter(a => a.ativo).length;
  const totalRascunhos = artigos.filter(a => !a.ativo).length;

  return (
    <>
      {modalArtigo !== false && (
        <ArtigoModal
          artigo={modalArtigo}
          categorias={categorias}
          onClose={() => setModalArtigo(false)}
        />
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-muted">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Base de Conhecimento</h1>
            </div>
            <p className="text-[13px] text-muted-foreground ml-10">Gerencie os artigos de ajuda disponíveis para os clientes</p>
          </div>
          <Button
            onClick={() => setModalArtigo({})}
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Artigo
          </Button>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total de Artigos', value: artigos.length, icon: BookOpen, color: 'text-muted-foreground' },
            { label: 'Publicados', value: totalAtivos, icon: Eye, color: 'text-emerald-500' },
            { label: 'Rascunhos', value: totalRascunhos, icon: EyeOff, color: 'text-amber-500' },
          ].map(m => (
            <div key={m.label} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={cn('h-3.5 w-3.5', m.color)} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{m.label}</p>
              </div>
              <p className="text-2xl font-bold text-foreground font-display tabular-nums">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <Input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por título, conteúdo ou tag..."
                className="pl-9 h-10 text-sm rounded-lg border-border/60"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFiltroCategoria('todos')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap',
                  filtroCategoria === 'todos'
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                Todos ({artigos.length})
              </button>
              {categorias.map(cat => {
                const count = artigos.filter(a => a.categoria_id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setFiltroCategoria(cat.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap',
                      filtroCategoria === cat.id
                        ? 'bg-foreground text-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <CatIcon icone={cat.icone} />
                    {cat.nome} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Lista de artigos */}
        {isLoading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : artigosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col items-center justify-center py-14 text-center">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <BookOpen className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum artigo encontrado</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">
              {artigos.length === 0 ? 'Crie o primeiro artigo para começar' : 'Tente ajustar os filtros'}
            </p>
            {artigos.length === 0 && (
              <Button
                onClick={() => setModalArtigo({})}
                variant="outline"
                className="mt-4 h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
              >
                <Plus className="h-3.5 w-3.5" />
                Criar primeiro artigo
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            {/* Sub-header colunas */}
            <div className="hidden md:flex items-center gap-4 px-5 py-2.5 border-b border-border/20 bg-muted/[0.02]">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 flex-1">Título</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 w-36">Categoria</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 w-24">Atualizado</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 w-20 text-center">Status</span>
              <span className="w-20" />
            </div>
            <div className="divide-y divide-border/30">
              {artigosFiltrados.map(artigo => (
                <div key={artigo.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors group">
                  {/* Título */}
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => setArtigoDetalhe(artigo)}
                      className="text-sm font-medium text-foreground hover:text-foreground/80 transition-colors text-left truncate block w-full"
                    >
                      {artigo.titulo}
                    </button>
                    {artigo.tags && artigo.tags.length > 0 && (
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {artigo.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[9px] text-muted-foreground/40">{tag}</span>
                        ))}
                        {artigo.tags.length > 3 && (
                          <span className="text-[9px] text-muted-foreground/30">+{artigo.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Categoria */}
                  <div className="hidden md:flex items-center gap-1.5 w-36 shrink-0">
                    {artigo.kb_categorias ? (
                      <>
                        <CatIcon icone={artigo.kb_categorias.icone} className="text-muted-foreground/40" />
                        <span className="text-xs text-muted-foreground/60 truncate">{artigo.kb_categorias.nome}</span>
                      </>
                    ) : <span className="text-xs text-muted-foreground/30">—</span>}
                  </div>

                  {/* Data */}
                  <div className="hidden md:block w-24 shrink-0">
                    <p className="text-[11px] text-muted-foreground/50">
                      {format(parseISO(artigo.updated_at), "d MMM yyyy", { locale: ptBR })}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="hidden md:flex justify-center w-20 shrink-0">
                    <button
                      onClick={() => toggleArtigo.mutate({ id: artigo.id, ativo: !artigo.ativo })}
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors cursor-pointer',
                        artigo.ativo
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'
                      )}
                    >
                      {artigo.ativo ? 'Publicado' : 'Rascunho'}
                    </button>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 w-20 shrink-0 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setModalArtigo(artigo)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleExcluir(artigo.id, artigo.titulo)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
