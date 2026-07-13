import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  BookOpen, Target, Heart, MessageCircle, Zap, AlertTriangle, TrendingUp,
  Shield, BarChart3, Star, DollarSign, Library,
} from 'lucide-react';

// Importação estática dos documentos CS
import doc01 from '../../../../conhecimento/operacional/cs/01-filosofia-e-modelo.md?raw';
import doc02 from '../../../../conhecimento/operacional/cs/02-jornada-do-cliente.md?raw';
import doc03 from '../../../../conhecimento/operacional/cs/03-health-score.md?raw';
import doc04 from '../../../../conhecimento/operacional/cs/04-cadencia-de-touchpoints.md?raw';
import doc05 from '../../../../conhecimento/operacional/cs/05-playbook-onboarding.md?raw';
import doc06 from '../../../../conhecimento/operacional/cs/06-playbook-engajamento.md?raw';
import doc07 from '../../../../conhecimento/operacional/cs/07-playbook-risco-churn.md?raw';
import doc08 from '../../../../conhecimento/operacional/cs/08-playbook-escalada.md?raw';
import doc09 from '../../../../conhecimento/operacional/cs/09-metricas-e-kpis.md?raw';
import doc10 from '../../../../conhecimento/operacional/cs/10-expansao-e-advocacy.md?raw';
import doc11 from '../../../../conhecimento/operacional/cs/11-resultado-no-crm.md?raw';

// ── Metadados dos documentos ──────────────────────────────────────────────────

type Categoria = 'fundamentos' | 'playbooks' | 'analise';

const CATEGORIAS: { id: Categoria; label: string; accent: string; chip: string }[] = [
  { id: 'fundamentos', label: 'Fundamentos',            accent: 'text-blue-600',    chip: 'bg-blue-50 text-blue-600 border-blue-100' },
  { id: 'playbooks',   label: 'Playbooks',              accent: 'text-violet-600',  chip: 'bg-violet-50 text-violet-600 border-violet-100' },
  { id: 'analise',     label: 'Análise & Crescimento',  accent: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
];

const DOCS = [
  { id: '01', titulo: 'Filosofia e Modelo',    subtitulo: 'Base filosófica do CS',   icon: BookOpen,      categoria: 'fundamentos', conteudo: doc01 },
  { id: '02', titulo: 'Jornada do Cliente',    subtitulo: 'D0 → Maturidade',         icon: Target,        categoria: 'fundamentos', conteudo: doc02 },
  { id: '03', titulo: 'Health Score',          subtitulo: 'Saúde em 2 eixos',        icon: Heart,         categoria: 'fundamentos', conteudo: doc03 },
  { id: '04', titulo: 'Cadência',              subtitulo: 'Touchpoints por fase',    icon: MessageCircle, categoria: 'fundamentos', conteudo: doc04 },
  { id: '05', titulo: 'Playbook Onboarding',   subtitulo: 'Fase de Ativação',        icon: Zap,           categoria: 'playbooks',   conteudo: doc05 },
  { id: '06', titulo: 'Playbook Engajamento',  subtitulo: 'Manter ritmo',            icon: TrendingUp,    categoria: 'playbooks',   conteudo: doc06 },
  { id: '07', titulo: 'Playbook Risco Churn',  subtitulo: 'Salvar o cliente',        icon: AlertTriangle, categoria: 'playbooks',   conteudo: doc07 },
  { id: '08', titulo: 'Playbook Escalada',     subtitulo: 'Casos críticos',          icon: Shield,        categoria: 'playbooks',   conteudo: doc08 },
  { id: '09', titulo: 'Métricas e KPIs',       subtitulo: 'O que medir',             icon: BarChart3,     categoria: 'analise',     conteudo: doc09 },
  { id: '11', titulo: 'Resultado no CRM',      subtitulo: 'O que o cliente percebe', icon: DollarSign,    categoria: 'analise',     conteudo: doc11 },
  { id: '10', titulo: 'Expansão e Advocacy',   subtitulo: 'Clientes promotores',     icon: Star,          categoria: 'analise',     conteudo: doc10 },
] as const;

const catMeta = (c: string) => CATEGORIAS.find(k => k.id === c) ?? CATEGORIAS[0];

// ── Renderer de markdown leve ─────────────────────────────────────────────────

function renderMarkdown(raw: string): string {
  // Remove o primeiro H1 (o título já aparece no header do painel — evita duplicar)
  let html = raw.replace(/^#\s+[^\n]*\n+/, '');

  // Escapar HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Blocos de código
  html = html.replace(/```[\s\S]*?```/g, match => {
    const code = match.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '');
    return `<pre class="md-pre"><code>${code}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

  // Cabeçalhos
  html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2 class="md-h2">$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1 class="md-h1">$1</h1>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>');

  // Tabelas
  html = html.replace(/(\|[^\n]+\|\n\|[-| :]+\|\n(?:\|[^\n]+\|\n?)*)/g, tableMatch => {
    const rows = tableMatch.trim().split('\n');
    const header = rows[0];
    const body = rows.slice(2);
    const thCells = header.split('|').filter(c => c.trim()).map(c => `<th class="md-th">${c.trim()}</th>`).join('');
    const bodyRows = body.map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td class="md-td">${c.trim()}</td>`).join('');
      return `<tr class="md-tr">${cells}</tr>`;
    }).join('');
    return `<div class="md-table-wrap"><table class="md-table"><thead><tr class="md-tr">${thCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
  });

  // Listas não-ordenadas
  html = html.replace(/(^- .+\n?)+/gm, listMatch => {
    const items = listMatch.trim().split('\n').map(line => `<li class="md-li">${line.replace(/^- /, '')}</li>`).join('');
    return `<ul class="md-ul">${items}</ul>`;
  });

  // Bold e itálico
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="md-strong">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em class="md-em">$1</em>');

  // Linhas horizontais
  html = html.replace(/^---$/gm, '<hr class="md-hr" />');

  // Parágrafos
  html = html.replace(/\n\n([^<\n][^\n]*)/g, '\n\n<p class="md-p">$1</p>');

  return html;
}

// ── DocsTab ───────────────────────────────────────────────────────────────────

export function DocsTab() {
  const [selectedId, setSelectedId] = useState<string>('01');
  const selectedDoc = DOCS.find(d => d.id === selectedId) ?? DOCS[0];
  const rendered = useMemo(() => renderMarkdown(selectedDoc.conteudo), [selectedDoc.id]);
  const cat = catMeta(selectedDoc.categoria);
  const ordinal = DOCS.findIndex(d => d.id === selectedDoc.id) + 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[288px_1fr] gap-5">

      {/* ── Sidebar de navegação ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden h-fit lg:sticky lg:top-4">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-muted"><Library className="h-3.5 w-3.5 text-muted-foreground" /></span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Documentação CS</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{DOCS.length} documentos · manual interno</p>
          </div>
        </div>

        <div className="p-2 space-y-3">
          {CATEGORIAS.map(categoria => {
            const docsDaCat = DOCS.filter(d => d.categoria === categoria.id);
            if (docsDaCat.length === 0) return null;
            return (
              <div key={categoria.id}>
                <p className={cn('px-3 pt-2 pb-1.5 text-[9px] font-bold uppercase tracking-widest', categoria.accent, 'opacity-70')}>
                  {categoria.label}
                </p>
                <div className="space-y-0.5">
                  {docsDaCat.map(doc => {
                    const Icon = doc.icon;
                    const isSelected = doc.id === selectedId;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => setSelectedId(doc.id)}
                        className={cn(
                          'w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2.5 transition-all',
                          isSelected ? 'bg-foreground text-background shadow-sm' : 'hover:bg-muted/60'
                        )}
                      >
                        <span className={cn(
                          'h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 border',
                          isSelected ? 'bg-background/15 border-transparent' : cn(categoria.chip)
                        )}>
                          <Icon className={cn('h-3.5 w-3.5', isSelected ? 'text-background' : '')} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-xs font-semibold truncate', isSelected ? 'text-background' : 'text-foreground')}>{doc.titulo}</p>
                          <p className={cn('text-[10px] truncate mt-0.5', isSelected ? 'text-background/60' : 'text-muted-foreground/50')}>{doc.subtitulo}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Painel de conteúdo ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Header do documento */}
        <div className="px-6 md:px-8 py-5 border-b border-border/40 bg-muted/[0.02] flex items-center gap-3.5">
          <span className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 border', cat.chip)}>
            <selectedDoc.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 tabular-nums">{ordinal} / {DOCS.length}</p>
              <span className={cn('text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md border', cat.chip)}>{cat.label}</span>
            </div>
            <h2 className="text-lg font-bold text-foreground font-display leading-tight mt-0.5">{selectedDoc.titulo}</h2>
          </div>
        </div>

        {/* Conteúdo renderizado */}
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          <div
            className="px-6 md:px-10 py-7 cs-docs-content mx-auto"
            dangerouslySetInnerHTML={{ __html: rendered }}
          />
        </div>
      </div>

      {/* Estilos do markdown */}
      <style>{`
        .cs-docs-content { max-width: 44rem; }
        .cs-docs-content > *:first-child { margin-top: 0 !important; }
        .cs-docs-content .md-h2 {
          font-size: 1.0625rem;
          font-weight: 700;
          color: var(--foreground);
          margin-top: 2rem;
          margin-bottom: 0.85rem;
          padding-bottom: 0.55rem;
          border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
          font-family: var(--font-display, inherit);
          letter-spacing: -0.01em;
        }
        .cs-docs-content .md-h3 {
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--foreground);
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .cs-docs-content .md-p {
          font-size: 0.875rem;
          color: var(--muted-foreground);
          line-height: 1.75;
          margin-bottom: 0.9rem;
        }
        .cs-docs-content .md-ul {
          margin: 0.6rem 0 1rem 0;
          padding: 0;
          list-style: none;
        }
        .cs-docs-content .md-li {
          position: relative;
          font-size: 0.875rem;
          color: var(--muted-foreground);
          line-height: 1.7;
          margin-bottom: 0.4rem;
          padding-left: 1.15rem;
        }
        .cs-docs-content .md-li::before {
          content: '';
          position: absolute;
          left: 0.15rem;
          top: 0.65rem;
          width: 0.3rem;
          height: 0.3rem;
          border-radius: 50%;
          background: color-mix(in srgb, var(--foreground) 35%, transparent);
        }
        .cs-docs-content .md-strong { font-weight: 600; color: var(--foreground); }
        .cs-docs-content .md-em { font-style: italic; }
        .cs-docs-content .md-hr {
          border: none;
          border-top: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
          margin: 2rem 0;
        }
        .cs-docs-content .md-quote {
          border-left: 3px solid color-mix(in srgb, var(--foreground) 25%, transparent);
          padding: 0.7rem 1rem;
          margin: 1rem 0;
          font-size: 0.84rem;
          line-height: 1.65;
          color: var(--muted-foreground);
          background: color-mix(in srgb, var(--muted) 35%, transparent);
          border-radius: 0 0.6rem 0.6rem 0;
        }
        .cs-docs-content .md-quote .md-strong { color: var(--foreground); }
        .cs-docs-content .md-pre {
          background: color-mix(in srgb, var(--muted) 55%, transparent);
          border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
          border-radius: 0.75rem;
          padding: 0.95rem 1.1rem;
          margin: 1rem 0;
          overflow-x: auto;
          font-size: 0.75rem;
          line-height: 1.65;
          color: var(--foreground);
          font-family: 'JetBrains Mono', monospace;
        }
        .cs-docs-content .md-code {
          background: color-mix(in srgb, var(--muted) 65%, transparent);
          border-radius: 0.3rem;
          padding: 0.1rem 0.35rem;
          font-size: 0.78rem;
          color: var(--foreground);
          font-family: 'JetBrains Mono', monospace;
        }
        .cs-docs-content .md-table-wrap {
          overflow-x: auto;
          margin: 1rem 0;
          border-radius: 0.75rem;
          border: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
        }
        .cs-docs-content .md-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }
        .cs-docs-content .md-th {
          background: color-mix(in srgb, var(--muted) 45%, transparent);
          padding: 0.6rem 0.85rem;
          text-align: left;
          font-weight: 700;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted-foreground);
          border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
          white-space: nowrap;
        }
        .cs-docs-content .md-td {
          padding: 0.6rem 0.85rem;
          color: var(--muted-foreground);
          border-bottom: 1px solid color-mix(in srgb, var(--border) 22%, transparent);
          vertical-align: top;
          line-height: 1.55;
        }
        .cs-docs-content .md-td .md-strong { color: var(--foreground); }
        .cs-docs-content .md-tr:last-child .md-td { border-bottom: none; }
        .cs-docs-content .md-tr:nth-child(even) { background: color-mix(in srgb, var(--muted) 14%, transparent); }
      `}</style>
    </div>
  );
}
