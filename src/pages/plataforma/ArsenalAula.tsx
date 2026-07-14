import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ChevronRight, ArrowLeft, Loader2, BookOpen, PenLine,
  PlayCircle, CheckCircle2, Clock, Circle, Save, ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useArsenalAulaDetalhe, AulaStatus } from '@/hooks/useArsenalAulas';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1);
    else if (u.hostname.includes('youtube.com')) videoId = u.searchParams.get('v');
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch { return null; }
}

const STATUS_CFG: Record<AulaStatus, { label: string; Icon: React.ElementType; bg: string; text: string; border: string }> = {
  nao_iniciado: {
    label: 'Não iniciada', Icon: Circle,
    bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border/60',
  },
  em_andamento: {
    label: 'Em andamento', Icon: Clock,
    bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20',
  },
  concluido: {
    label: 'Concluída', Icon: CheckCircle2,
    bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20',
  },
};

function StatusBadge({ status, size = 'sm' }: { status: AulaStatus; size?: 'xs' | 'sm' }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-md border font-medium',
      cfg.bg, cfg.text, cfg.border,
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
    )}>
      <cfg.Icon className={size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {cfg.label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArsenalAula() {
  const { aulaSlug = '' } = useParams<{ aulaSlug: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'assista' | 'anotacoes'>('assista');

  const {
    aula, bloco, status, anotacoes,
    aulasIrmas, isLoading,
    marcarEmAndamento, salvarAnotacoes,
  } = useArsenalAulaDetalhe(aulaSlug);

  // Anotações local state + autosave
  const [localAnotacoes, setLocalAnotacoes] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (anotacoes !== undefined) setLocalAnotacoes(anotacoes ?? '');
  }, [anotacoes]);

  // Mark em_andamento on open
  useEffect(() => {
    if (aula && status === 'nao_iniciado') {
      marcarEmAndamento.mutate();
    }
  }, [aula?.id]);

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
  }, []);

  const doSave = useCallback(async (value: string) => {
    setSaveStatus('saving');
    try {
      await salvarAnotacoes.mutateAsync(value);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      toast.error('Erro ao salvar anotações.');
      setSaveStatus('idle');
    }
  }, [salvarAnotacoes]);

  const handleAnotacoesChange = (value: string) => {
    setLocalAnotacoes(value);
    setSaveStatus('idle');
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => doSave(value), 30000);
  };

  const handleSaveManual = () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    doSave(localAnotacoes);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!aula) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-3 rounded-xl bg-muted/40 mb-3">
          <GraduationCap className="h-6 w-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Aula não encontrada</p>
      </div>
    );
  }

  const embedUrl = aula.video_url ? toEmbedUrl(aula.video_url) : null;

  return (
    <div className="max-w-[1400px] mx-auto pb-12">

      {/* ─── Breadcrumb ─── */}
      <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-6 flex-wrap">
        <Link to="/plataforma/arsenal" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Arsenal
        </Link>
        <ChevronRight className="h-3 w-3 flex-shrink-0" />
        <button onClick={() => navigate('/plataforma/arsenal')} className="hover:text-foreground transition-colors">
          Aulas
        </button>
        {bloco && (
          <>
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
            <span className="truncate max-w-[140px]">{bloco.nome}</span>
          </>
        )}
        <ChevronRight className="h-3 w-3 flex-shrink-0" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{aula.nome}</span>
      </nav>

      <div className="flex gap-6">

        {/* ─── Sidebar ─── */}
        <aside className="hidden lg:block w-60 flex-shrink-0">
          <div className="sticky top-6 rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="px-4 py-3.5 border-b border-border/40 bg-muted/[0.03]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                {bloco?.nome ?? 'Aulas'}
              </p>
            </div>
            <div className="py-2">
              {aulasIrmas.map((a, idx) => {
                const isCurrent = a.slug === aulaSlug;
                const cfg = STATUS_CFG[a.status];
                return (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/plataforma/arsenal/aulas/${a.slug}`)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                      isCurrent
                        ? 'bg-foreground/[0.06]'
                        : 'hover:bg-muted/40',
                    )}
                  >
                    <span className={cn(
                      'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5',
                      isCurrent ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                    )}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-[12px] leading-snug',
                        isCurrent ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
                      )}>
                        {a.nome}
                      </p>
                      <span className={cn(
                        'inline-flex items-center gap-1 mt-1 text-[10px] font-medium',
                        cfg.text,
                      )}>
                        <cfg.Icon className="h-2.5 w-2.5" />
                        {cfg.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ─── Main content ─── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Title + status */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Aula</p>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-display leading-snug">
                {aula.nome}
              </h1>
              {aula.descricao && (
                <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">{aula.descricao}</p>
              )}
            </div>
            <StatusBadge status={status} />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit">
            {([
              { key: 'assista' as const, label: 'Assista', Icon: BookOpen },
              { key: 'anotacoes' as const, label: 'Anotações', Icon: PenLine },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-5 py-2 text-[13px] font-medium rounded-lg transition-all duration-200',
                  activeTab === tab.key
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <tab.Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Tab: Assista ─── */}
          {activeTab === 'assista' && (
            <div className="space-y-4">
              {/* Vídeo */}
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                {embedUrl ? (
                  <div className="aspect-video bg-black">
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={aula.nome}
                    />
                  </div>
                ) : (
                  <div className="aspect-video flex flex-col items-center justify-center bg-muted/30 gap-4">
                    <div className="p-4 rounded-2xl bg-muted border border-border/60">
                      <PlayCircle className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-medium text-muted-foreground">Conteúdo em breve</p>
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                        Esta aula está sendo produzida.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Texto de contexto */}
              {aula.texto_aprenda && (
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                  <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-muted">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">CONTEXTO</p>
                    </div>
                  </div>
                  <div className="px-6 py-5 text-[14px] text-foreground/80 leading-[1.8] whitespace-pre-wrap">
                    {aula.texto_aprenda}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => setActiveTab('anotacoes')}
                  className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
                >
                  Ir para Anotações <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── Tab: Anotações ─── */}
          {activeTab === 'anotacoes' && (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted">
                    <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">SUAS ANOTAÇÕES</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      Registre aqui seus insights e plano de ação desta aula.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {saveStatus === 'saving' && (
                    <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="text-[11px] text-emerald-600 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3" /> Salvo
                    </span>
                  )}
                  <Button
                    onClick={handleSaveManual}
                    disabled={saveStatus === 'saving'}
                    className="h-8 rounded-lg text-[11px] font-medium border border-border/60 gap-1.5 px-3 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                    {status === 'concluido' ? 'Atualizar' : 'Salvar'}
                  </Button>
                </div>
              </div>

              <div className="p-5">
                <textarea
                  value={localAnotacoes}
                  onChange={e => handleAnotacoesChange(e.target.value)}
                  placeholder="O que você aprendeu? Quais ações vai tomar? Quais dúvidas ficaram?"
                  className="w-full min-h-[360px] resize-none bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/40 leading-[1.8] outline-none"
                />
              </div>

              {saveStatus !== 'saving' && saveStatus !== 'saved' && localAnotacoes && (
                <p className="px-5 pb-4 text-[10px] text-muted-foreground/40">
                  Salva automaticamente a cada 30 segundos.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
