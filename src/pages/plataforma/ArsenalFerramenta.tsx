import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import {
  ChevronRight, Swords, Loader2, CheckCircle2, Clock, Circle,
  Save, ArrowRight, PlayCircle, ArrowLeft, BookOpen, Hammer,
  Sparkles, BookMarked, FileText, Globe, Maximize2,
} from 'lucide-react';
import { getRichExtensions, RichToolbar, EDITOR_STYLES } from '@/components/editor/RichEditor';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useArsenalFerramenta, useArsenalMateriais, fetchArsenalMaterialHtml,
  ArsenalStatus, ArsenalMaterial,
} from '@/hooks/useArsenal';

// ─── Temas por categoria (igual ao ArsenalCategoria) ─────────────────────────

const SLUG_THEMES: Record<string, { gradient: string; accent: string; glow: string }> = {
  'diagnostico-clareza':                { gradient: 'from-violet-600/80 via-violet-900/60 to-slate-900', accent: '#8b5cf6', glow: 'rgba(139,92,246,0.12)' },
  'oferta-precificacao-valor':          { gradient: 'from-amber-600/80 via-amber-900/60 to-slate-900',  accent: '#f59e0b', glow: 'rgba(245,158,11,0.12)' },
  'atendimento-conversao':              { gradient: 'from-cyan-600/80 via-cyan-900/60 to-slate-900',    accent: '#06b6d4', glow: 'rgba(6,182,212,0.12)' },
  'funil-followup-reativacao':          { gradient: 'from-emerald-600/80 via-emerald-900/60 to-slate-900', accent: '#10b981', glow: 'rgba(16,185,129,0.12)' },
  'alto-ticket-protocolos-recorrencia': { gradient: 'from-rose-600/80 via-rose-900/60 to-slate-900',    accent: '#f43f5e', glow: 'rgba(244,63,94,0.12)' },
  'canais-aquisicao':                   { gradient: 'from-blue-600/80 via-blue-900/60 to-slate-900',    accent: '#3b82f6', glow: 'rgba(59,130,246,0.12)' },
  'montando-equipe-comercial':          { gradient: 'from-orange-600/80 via-orange-900/60 to-slate-900', accent: '#f97316', glow: 'rgba(249,115,22,0.12)' },
  'gestao-time-comercial':              { gradient: 'from-indigo-600/80 via-indigo-900/60 to-slate-900', accent: '#6366f1', glow: 'rgba(99,102,241,0.12)' },
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ArsenalStatus, { label: string; icon: React.ElementType; heroBg: string; heroText: string; lightBg: string; lightText: string; lightBorder: string }> = {
  nao_iniciado: {
    label: 'Não iniciado', icon: Circle,
    heroBg: 'bg-white/[0.06]', heroText: 'text-white/50',
    lightBg: 'bg-muted', lightText: 'text-muted-foreground', lightBorder: 'border-border/60',
  },
  em_andamento: {
    label: 'Em andamento', icon: Clock,
    heroBg: 'bg-amber-500/15', heroText: 'text-amber-200',
    lightBg: 'bg-amber-500/10', lightText: 'text-amber-600', lightBorder: 'border-amber-500/20',
  },
  concluido: {
    label: 'Concluído', icon: CheckCircle2,
    heroBg: 'bg-emerald-500/15', heroText: 'text-emerald-200',
    lightBg: 'bg-emerald-500/10', lightText: 'text-emerald-600', lightBorder: 'border-emerald-500/20',
  },
};

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1);
    else if (u.hostname.includes('youtube.com')) videoId = u.searchParams.get('v');
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch { return null; }
}

// ─── Material card ────────────────────────────────────────────────────────────

function MaterialCard({ material }: { material: ArsenalMaterial }) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenHtml = async () => {
    if (htmlContent !== null) { setDialogOpen(true); return; }
    setLoading(true);
    try {
      const html = await fetchArsenalMaterialHtml(material.id);
      setHtmlContent(html);
      setDialogOpen(true);
    } catch {
      toast.error('Erro ao carregar o material.');
    } finally {
      setLoading(false);
    }
  };

  const handleFullscreen = () => {
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  return (
    <>
      <div className="group flex items-center gap-4 px-5 py-4 rounded-xl border border-border/60 bg-background hover:border-border hover:shadow-sm transition-all duration-200">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          {material.tipo === 'pdf'
            ? <FileText className="h-4 w-4 text-rose-500/70" />
            : <Globe className="h-4 w-4 text-cyan-500/70" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-foreground leading-snug truncate">{material.titulo}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 uppercase tracking-wider font-mono">
            {material.tipo === 'pdf' ? 'PDF' : 'Conteúdo HTML'}
          </p>
        </div>
        {material.tipo === 'pdf' ? (
          <Button onClick={() => window.open(material.pdf_url!, '_blank')}
            className="h-8 rounded-lg text-[11px] font-medium border border-border/60 bg-background text-foreground hover:bg-muted px-3 gap-1.5 flex-shrink-0" variant="outline">
            <FileText className="h-3 w-3" /> Abrir PDF
          </Button>
        ) : (
          <Button onClick={handleOpenHtml} disabled={loading}
            className="h-8 rounded-lg text-[11px] font-medium border border-border/60 bg-background text-foreground hover:bg-muted px-3 gap-1.5 flex-shrink-0" variant="outline">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
            Visualizar
          </Button>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl w-full h-[80vh] p-0 flex flex-col">
          <DialogHeader className="flex-shrink-0 flex flex-row items-center justify-between px-5 py-3.5 border-b border-border/60">
            <DialogTitle className="text-[13px] font-semibold text-foreground truncate">{material.titulo}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleFullscreen}
              className="h-7 w-7 rounded-lg flex-shrink-0">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {htmlContent !== null && (
              <iframe srcDoc={htmlContent} className="w-full h-full border-0"
                title={material.titulo} sandbox="allow-scripts allow-same-origin" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArsenalFerramenta() {
  const { slug: catSlug = '', ferrSlug = '' } = useParams<{ slug: string; ferrSlug: string }>();
  const [activeTab, setActiveTab] = useState<'aprenda' | 'construa' | 'materiais'>('aprenda');
  const editorInitialized = useRef(false);
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);

  const {
    ferramenta, categoria, status, construcao,
    isLoading, marcarEmAndamento, salvarConstrucao,
  } = useArsenalFerramenta(ferrSlug);

  const { data: materiais = [], isLoading: materiaisLoading } = useArsenalMateriais(ferramenta?.id);

  const editor = useEditor({
    extensions: getRichExtensions(),
    content: '',
    editorProps: {
      attributes: { class: 'outline-none min-h-[280px] cursor-text' },
    },
    onUpdate: ({ editor }) => setIsEditorEmpty(editor.isEmpty),
  });

  useEffect(() => {
    if (construcao !== undefined && editor && !editorInitialized.current) {
      editor.commands.setContent(construcao || '');
      setIsEditorEmpty(editor.isEmpty);
      editorInitialized.current = true;
    }
  }, [construcao, editor]);

  useEffect(() => {
    if (ferramenta && status === 'nao_iniciado') {
      marcarEmAndamento.mutate();
    }
  }, [ferramenta?.id]);

  const handleSalvar = async () => {
    if (!editor || editor.isEmpty) {
      toast.error('Escreva algo antes de salvar.');
      return;
    }
    try {
      await salvarConstrucao.mutateAsync(editor.getHTML());
      toast.success('Salvo em Meus Materiais');
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ferramenta) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-3 rounded-xl bg-muted/40 mb-3">
          <Swords className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Ferramenta não encontrada</p>
      </div>
    );
  }

  const embedUrl = ferramenta.video_url ? toEmbedUrl(ferramenta.video_url) : null;
  const cfg = STATUS_CONFIG[status];
  const StatusIcon = cfg.icon;
  const theme = SLUG_THEMES[catSlug] ?? SLUG_THEMES['diagnostico-clareza'];

  const tabs = [
    { key: 'aprenda'   as const, label: 'Aprenda',   icon: BookOpen },
    { key: 'materiais' as const, label: 'Materiais', icon: BookMarked, badge: materiais.length > 0 ? materiais.length : undefined },
    { key: 'construa'  as const, label: 'Construa',  icon: Hammer },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">

      {/* ─── Breadcrumb ─── */}
      <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground flex-wrap">
        <Link to="/plataforma/arsenal" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Arsenal
        </Link>
        <ChevronRight className="h-3 w-3 flex-shrink-0" />
        <Link to={`/plataforma/arsenal/${catSlug}`} className="hover:text-foreground transition-colors truncate max-w-[160px]">
          {categoria?.nome ?? '…'}
        </Link>
        <ChevronRight className="h-3 w-3 flex-shrink-0" />
        <span className="text-foreground font-medium truncate max-w-[220px]">{ferramenta.nome}</span>
      </nav>

      {/* ─── Hero ─── */}
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.gradient}`}
        style={{ boxShadow: `0 8px 40px ${theme.glow}` }}
      >
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full opacity-20 blur-[80px]"
          style={{ background: `radial-gradient(circle, ${theme.accent}, transparent 70%)` }} />

        <div className="relative z-10 px-8 py-8 sm:px-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.08]">
                  <Swords className="h-4 w-4 text-white/70" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Ferramenta</p>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display leading-snug pr-4">
                {ferramenta.nome}
              </h1>
              {ferramenta.descricao && (
                <p className="text-[13px] text-white/50 max-w-lg leading-relaxed">{ferramenta.descricao}</p>
              )}
            </div>
            <span className={`flex items-center gap-2 flex-shrink-0 px-4 py-2 rounded-xl text-[12px] font-medium ${cfg.heroBg} ${cfg.heroText} border border-white/[0.06] backdrop-blur-sm self-start`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {cfg.label}
            </span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-8 bg-white/[0.04] rounded-xl p-1 w-fit border border-white/[0.06]">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}>
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.badge !== undefined && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums leading-none ${
                    activeTab === tab.key ? 'bg-slate-900/20 text-slate-900' : 'bg-white/[0.08] text-white/50'
                  }`}>{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Tab: Aprenda ─── */}
      {activeTab === 'aprenda' && (
        <div className="space-y-4">
          {/* Vídeo */}
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            {embedUrl ? (
              <div className="aspect-video bg-black">
                <iframe src={embedUrl} className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen title={ferramenta.nome} />
              </div>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center bg-muted/30 gap-4">
                <div className="p-4 rounded-2xl bg-muted border border-border/60">
                  <PlayCircle className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <p className="text-[13px] text-muted-foreground/50 font-medium">Conteúdo em breve</p>
              </div>
            )}
          </div>

          {/* Conceito */}
          {ferramenta.texto_aprenda && (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">CONCEITO</p>
                </div>
              </div>
              <div className="px-6 py-5 text-[14px] text-foreground/80 leading-[1.8] whitespace-pre-wrap">
                {ferramenta.texto_aprenda}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setActiveTab('construa')}
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5">
              Ir para Construção <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Tab: Construa ─── */}
      {activeTab === 'construa' && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Hammer className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">CONSTRUA</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Ao salvar, vai para Meus Materiais</p>
              </div>
            </div>
          </div>

          <div className="border-b border-border/40">
            <RichToolbar editor={editor} compact />
          </div>

          <div
            className={cn(
              'mx-5 my-5 rounded-xl bg-background border border-border/60 px-6 py-5 cursor-text',
              EDITOR_STYLES,
              '[&_.ProseMirror]:min-h-[260px]',
            )}
            onClick={() => editor?.commands.focus()}
          >
            {isEditorEmpty && (
              <p className="absolute text-[14px] text-muted-foreground/40 pointer-events-none leading-[1.85]">
                {ferramenta.template_construa ?? 'Escreva aqui o que você vai construir...'}
              </p>
            )}
            <EditorContent editor={editor} />
          </div>

          <div className="flex items-center justify-end px-5 py-3.5 border-t border-border/40 bg-muted/20">
            <Button
              onClick={handleSalvar}
              disabled={salvarConstrucao.isPending}
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 disabled:opacity-50"
            >
              {salvarConstrucao.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Save className="h-3.5 w-3.5" />}
              {status === 'concluido' ? 'Atualizar' : 'Salvar em Meus Materiais'}
            </Button>
          </div>
        </div>
      )}

      {/* ─── Tab: Materiais ─── */}
      {activeTab === 'materiais' && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <BookMarked className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">MATERIAIS COMPLEMENTARES</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">PDFs e conteúdos de apoio</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {materiaisLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
              </div>
            ) : materiais.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <BookMarked className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhum material disponível</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">Materiais serão adicionados em breve.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {materiais.map(material => <MaterialCard key={material.id} material={material} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
