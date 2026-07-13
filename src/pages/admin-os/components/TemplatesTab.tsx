import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Copy, Pencil, Plus, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// ── Tipos ─────────────────────────────────────────────────────────────────

interface CSTemplate {
  id: string;
  nome: string;
  categoria: string;
  fase: string | null;
  conteudo: string;
  variaveis: string[];
  ativo: boolean;
  created_at: string;
}

const CATEGORIA_LABELS: Record<string, string> = {
  ativacao: 'Ativação',
  execucao: 'Execução',
  risco: 'Risco',
  escalada: 'Escalada',
  expansao: 'Expansão',
};

const CATEGORIA_COLORS: Record<string, string> = {
  ativacao: 'text-blue-700 bg-blue-50 border-blue-200',
  execucao: 'text-violet-700 bg-violet-50 border-violet-200',
  risco: 'text-red-700 bg-red-50 border-red-200',
  escalada: 'text-amber-700 bg-amber-50 border-amber-200',
  expansao: 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

// ── Hook ──────────────────────────────────────────────────────────────────

function useCSTemplates() {
  return useQuery({
    queryKey: ['cs-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cs_templates')
        .select('*')
        .eq('ativo', true)
        .order('categoria')
        .order('created_at');
      if (error) throw error;
      return (data || []) as CSTemplate[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── EditTemplateModal ──────────────────────────────────────────────────────

function EditTemplateModal({ template, onClose }: {
  template: CSTemplate | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isNew = !template;
  const [nome, setNome] = useState(template?.nome ?? '');
  const [categoria, setCategoria] = useState(template?.categoria ?? 'ativacao');
  const [fase, setFase] = useState(template?.fase ?? '');
  const [conteudo, setConteudo] = useState(template?.conteudo ?? '');

  // Extract variables from content on the fly
  const variaveis = Array.from(new Set((conteudo.match(/\[([^\]]+)\]/g) ?? []).map(m => m.slice(1, -1))));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { nome, categoria, fase: fase || null, conteudo, variaveis };
      if (isNew) {
        const { error } = await supabase.from('cs_templates').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cs_templates').update(payload).eq('id', template!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isNew ? 'Template criado' : 'Template atualizado');
      qc.invalidateQueries({ queryKey: ['cs-templates'] });
      onClose();
    },
    onError: () => toast.error('Erro ao salvar template'),
  });

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{isNew ? 'Novo template' : 'Editar template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Pulse D3 — Pós-kickoff" className="h-10 text-sm rounded-lg border-border/60" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIA_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fase / Momento</Label>
              <Input value={fase} onChange={e => setFase(e.target.value)} placeholder="Ex: d3, ghosting_d1..." className="h-10 text-sm rounded-lg border-border/60" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conteúdo</Label>
            <Textarea
              value={conteudo}
              onChange={e => setConteudo(e.target.value)}
              placeholder="Use [variavel] para inserir placeholders dinâmicos. Ex: Oi [nome], tudo bem?"
              rows={8}
              className="text-sm rounded-lg border-border/60 resize-none font-mono"
            />
          </div>
          {variaveis.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-muted-foreground/60">Variáveis detectadas:</span>
              {variaveis.map(v => (
                <span key={v} className="text-[10px] font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">[{v}]</span>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9 rounded-lg text-xs" onClick={onClose}>Cancelar</Button>
            <Button
              className="flex-1 h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90"
              disabled={!nome.trim() || !conteudo.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Salvando...' : isNew ? 'Criar template' : 'Salvar alterações'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── TemplateCard ───────────────────────────────────────────────────────────

function TemplateCard({ template, onEdit }: { template: CSTemplate; onEdit: () => void }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(template.conteudo);
    setCopied(true);
    toast.success('Copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const preview = template.conteudo.length > 140
    ? template.conteudo.slice(0, 140).replace(/\n/g, ' ') + '...'
    : template.conteudo;

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden group">
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <p className="text-sm font-semibold">{template.nome}</p>
              <span className={cn('text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border', CATEGORIA_COLORS[template.categoria])}>
                {CATEGORIA_LABELS[template.categoria]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              {expanded ? template.conteudo.split('\n').map((line, i) => (
                <span key={i}>{line}<br /></span>
              )) : preview}
            </p>
            {template.conteudo.length > 140 && (
              <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground mt-1 transition-colors">
                {expanded ? 'Mostrar menos' : 'Mostrar tudo'}
              </button>
            )}
            {template.variaveis.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2.5">
                {template.variaveis.map(v => (
                  <span key={v} className="text-[9px] font-mono bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded">[{v}]</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end px-5 py-3 border-t border-border/40 bg-muted/20 gap-2">
        <Button size="sm" variant="outline" className="h-7 rounded-lg text-[10px] border-border/60 gap-1.5 px-2.5" onClick={onEdit}>
          <Pencil className="h-3 w-3" />Editar
        </Button>
        <Button size="sm" className="h-7 rounded-lg text-[10px] font-semibold bg-foreground text-background hover:bg-foreground/90 gap-1.5 px-2.5" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export function TemplatesTab() {
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editTemplate, setEditTemplate] = useState<CSTemplate | 'new' | null>(null);

  const { data: templates = [] } = useCSTemplates();

  const filtered = templates.filter(t => {
    if (category !== 'all' && t.categoria !== category) return false;
    if (search && !t.nome.toLowerCase().includes(search.toLowerCase()) && !t.conteudo.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by category for display
  const grouped = filtered.reduce<Record<string, CSTemplate[]>>((acc, t) => {
    if (!acc[t.categoria]) acc[t.categoria] = [];
    acc[t.categoria].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar template..." className="pl-9 h-9 text-sm rounded-lg border-border/60" />
        </div>
        <div className="bg-muted/40 rounded-xl p-1 flex gap-0.5 flex-wrap">
          <button
            onClick={() => setCategory('all')}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', category === 'all' ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            Todos ({templates.length})
          </button>
          {Object.entries(CATEGORIA_LABELS).map(([v, l]) => {
            const count = templates.filter(t => t.categoria === v).length;
            return (
              <button
                key={v}
                onClick={() => setCategory(v)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', category === v ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                {l} ({count})
              </button>
            );
          })}
        </div>
        <Button
          className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5 flex-shrink-0"
          onClick={() => setEditTemplate('new')}
        >
          <Plus className="h-3.5 w-3.5" />Novo template
        </Button>
      </div>

      {/* Grid por categoria */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3"><Copy className="h-6 w-6 text-muted-foreground/40" /></div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum template encontrado</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Ajuste o filtro ou crie um novo template</p>
        </div>
      ) : category !== 'all' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(t => (
            <TemplateCard key={t.id} template={t} onEdit={() => setEditTemplate(t)} />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-4">
                <span className={cn('text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg border', CATEGORIA_COLORS[cat])}>
                  {CATEGORIA_LABELS[cat]}
                </span>
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[10px] text-muted-foreground/40">{list.length} template{list.length > 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {list.map(t => (
                  <TemplateCard key={t.id} template={t} onEdit={() => setEditTemplate(t)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editTemplate !== null && (
        <EditTemplateModal
          template={editTemplate === 'new' ? null : editTemplate}
          onClose={() => setEditTemplate(null)}
        />
      )}
    </div>
  );
}
