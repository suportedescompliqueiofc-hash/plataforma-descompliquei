import { useState, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, FileText, LayoutTemplate, Loader2, Check, NotebookPen,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  useArsenalHub, useFerramentasByCategoria, useArsenalTemplates,
  ArsenalTemplate,
} from '@/hooks/useArsenal';
import { useCreateDocumento, MeuMaterial } from '@/hooks/useMeusMateriais';

// ─── Cores por slug de categoria ─────────────────────────────────────────────

const SLUG_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'diagnostico-clareza':                { bg: 'bg-violet-50 hover:bg-violet-100',  border: 'border-violet-200',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  'oferta-precificacao-valor':          { bg: 'bg-amber-50 hover:bg-amber-100',    border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  'atendimento-conversao':              { bg: 'bg-cyan-50 hover:bg-cyan-100',      border: 'border-cyan-200',    text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  'funil-followup-reativacao':          { bg: 'bg-emerald-50 hover:bg-emerald-100',border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'alto-ticket-protocolos-recorrencia': { bg: 'bg-rose-50 hover:bg-rose-100',      border: 'border-rose-200',    text: 'text-rose-700',    dot: 'bg-rose-500' },
  'canais-aquisicao':                   { bg: 'bg-blue-50 hover:bg-blue-100',      border: 'border-blue-200',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  'montando-equipe-comercial':          { bg: 'bg-orange-50 hover:bg-orange-100',  border: 'border-orange-200',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  'gestao-time-comercial':              { bg: 'bg-indigo-50 hover:bg-indigo-100',  border: 'border-indigo-200',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
};

const DEFAULT_COLORS = { bg: 'bg-muted/40 hover:bg-muted/60', border: 'border-border/60', text: 'text-muted-foreground', dot: 'bg-muted-foreground' };

function colors(slug: string) { return SLUG_COLORS[slug] ?? DEFAULT_COLORS; }

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  existingMateriais?: MeuMaterial[];
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function NovoMaterialModal({ open, onClose, onCreated, existingMateriais = [] }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCat, setSelectedCat] = useState<ReturnType<typeof useArsenalHub>['categorias'][0] | null>(null);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ArsenalTemplate | null>(null);

  const { categorias, isLoading: catsLoading } = useArsenalHub();
  const { data: ferramentas = [], isLoading: ferrLoading } = useFerramentasByCategoria(selectedCat?.id);
  const { data: templates = [], isLoading: templatesLoading } = useArsenalTemplates(selectedToolId ?? undefined);
  const createDoc = useCreateDocumento();

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(1);
        setSelectedCat(null);
        setSelectedToolId(null);
        setSelectedTemplate(null);
      }, 200);
    }
  }, [open]);

  const handleSelectCat = (cat: typeof categorias[0]) => {
    setSelectedCat(cat);
    setSelectedToolId(null);
    setSelectedTemplate(null);
    setStep(2);
  };

  const handleCreateLivre = async () => {
    try {
      const id = await createDoc.mutateAsync({ titulo: 'Sem título', conteudo: '' });
      onClose();
      onCreated(id);
    } catch {
      toast.error('Erro ao criar documento.');
    }
  };

  const handleBack = () => {
    setStep(1);
    setSelectedCat(null);
    setSelectedToolId(null);
    setSelectedTemplate(null);
  };

  const handleSelectTool = (toolId: string) => {
    setSelectedToolId(prev => (prev === toolId ? null : toolId));
    setSelectedTemplate(null);
  };

  const handleSelectTemplate = (t: ArsenalTemplate) => {
    setSelectedTemplate(prev => (prev?.id === t.id ? null : t));
  };

  const handleCreate = async () => {
    if (!selectedToolId || !selectedCat) return;

    // Se já existe documento para esta ferramenta, navegar para ele
    const existing = existingMateriais.find(m => m.ferramenta_id === selectedToolId);
    if (existing) {
      onClose();
      onCreated(existing.id);
      toast.info('Você já tem um documento para esta ferramenta. Abrindo...');
      return;
    }

    const tool = ferramentas.find(f => f.id === selectedToolId);
    try {
      const id = await createDoc.mutateAsync({
        titulo: selectedTemplate ? selectedTemplate.titulo : (tool?.nome ?? 'Sem título'),
        conteudo: selectedTemplate ? selectedTemplate.conteudo : '',
        ferramenta_id: selectedToolId,
        categoria_arsenal_id: selectedCat.id,
      });
      onClose();
      onCreated(id);
    } catch {
      toast.error('Erro ao criar documento.');
    }
  };

  const selectedTool = ferramentas.find(f => f.id === selectedToolId);
  const hasExistingForTool = selectedToolId
    ? existingMateriais.some(m => m.ferramenta_id === selectedToolId)
    : false;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button
                onClick={handleBack}
                className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                {step === 1 ? 'PASSO 1 DE 2' : 'PASSO 2 DE 2'}
              </p>
              <h2 className="text-[15px] font-semibold text-foreground font-display leading-tight">
                {step === 1 ? 'Escolha a categoria' : (selectedCat?.nome ?? 'Escolha a ferramenta')}
              </h2>
            </div>
          </div>

          {/* Step dots */}
          <div className="flex items-center gap-1.5 mr-6">
            <div className="w-2 h-2 rounded-full bg-foreground" />
            <div className={`w-2 h-2 rounded-full transition-colors ${step === 2 ? 'bg-foreground' : 'bg-muted-foreground/20'}`} />
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="overflow-y-auto max-h-[62vh]">
          {/* Step 1: Categorias */}
          {step === 1 && (
            <div className="p-6">
              {catsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Card Livre */}
                  <button
                    onClick={handleCreateLivre}
                    disabled={createDoc.isPending}
                    className="group col-span-2 flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/50 transition-all duration-150 text-left"
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-muted-foreground/40" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-snug text-foreground">Documento Livre</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Sem categoria — anotações, rascunhos ou qualquer conteúdo</p>
                    </div>
                    {createDoc.isPending
                      ? <Loader2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground animate-spin" />
                      : <NotebookPen className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    }
                  </button>

                  {/* Divisor */}
                  <div className="col-span-2 flex items-center gap-3">
                    <div className="flex-1 h-px bg-border/40" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">ou escolha uma categoria</span>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>

                  {/* Categorias do Arsenal */}
                  {categorias.map(cat => {
                    const c = colors(cat.slug);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectCat(cat)}
                        className={`group flex items-center gap-3 p-4 rounded-xl border transition-all duration-150 text-left ${c.bg} ${c.border}`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-[13px] font-semibold leading-snug ${c.text}`}>{cat.nome}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{cat.total} ferramentas</p>
                        </div>
                        <ArrowRight className={`h-3.5 w-3.5 flex-shrink-0 ${c.text} opacity-0 group-hover:opacity-60 transition-opacity`} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Ferramentas + Templates */}
          {step === 2 && (
            <div className="p-6 space-y-6">
              {/* Ferramentas */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
                  FERRAMENTAS
                </p>
                {ferrLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {ferramentas.map(f => {
                      const isSelected = selectedToolId === f.id;
                      const hasDoc = existingMateriais.some(m => m.ferramenta_id === f.id);
                      return (
                        <button
                          key={f.id}
                          onClick={() => handleSelectTool(f.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 text-left ${
                            isSelected
                              ? 'border-foreground/30 bg-foreground/[0.04] shadow-sm'
                              : 'border-border/50 bg-card hover:border-border hover:bg-muted/20'
                          }`}
                        >
                          {/* Radio circle */}
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                            isSelected ? 'border-foreground bg-foreground' : 'border-border/60'
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                          </div>
                          <span className="text-[13px] font-medium text-foreground flex-1 leading-snug">
                            {f.nome}
                          </span>
                          {hasDoc && (
                            <span className="text-[10px] font-medium text-muted-foreground/50 bg-muted/60 px-2 py-0.5 rounded-full flex-shrink-0">
                              Já tem doc
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Templates (aparece ao selecionar ferramenta) */}
              {selectedToolId && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
                    TEMPLATES DISPONÍVEIS
                  </p>
                  {templatesLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-5 rounded-xl border border-dashed border-border/50 bg-muted/10">
                      <LayoutTemplate className="h-5 w-5 text-muted-foreground/30 mb-2" />
                      <p className="text-[12px] text-muted-foreground/60 font-medium">Nenhum template para esta ferramenta.</p>
                      <p className="text-[11px] text-muted-foreground/40 mt-0.5">Crie um documento em branco abaixo.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {templates.map(t => {
                        const isSelected = selectedTemplate?.id === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => handleSelectTemplate(t)}
                            className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition-all duration-150 text-left ${
                              isSelected
                                ? 'border-foreground/30 bg-foreground/[0.04] shadow-sm'
                                : 'border-border/50 bg-card hover:border-border hover:bg-muted/20'
                            }`}
                          >
                            {/* Checkbox square */}
                            <div className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                              isSelected ? 'border-foreground bg-foreground' : 'border-border/60'
                            }`}>
                              {isSelected && <Check className="h-2.5 w-2.5 text-background" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-foreground leading-snug">{t.titulo}</p>
                              {t.descricao && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{t.descricao}</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Footer (passo 2) ─── */}
        {step === 2 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/20">
            <p className="text-[12px] text-muted-foreground">
              {!selectedToolId
                ? 'Selecione uma ferramenta para continuar'
                : hasExistingForTool
                ? 'Você já tem um documento — será aberto.'
                : selectedTemplate
                ? `Template: "${selectedTemplate.titulo}"`
                : `Em branco — ${selectedTool?.nome}`}
            </p>
            <Button
              onClick={handleCreate}
              disabled={!selectedToolId || createDoc.isPending}
              className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5 disabled:opacity-30"
            >
              {createDoc.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : hasExistingForTool ? (
                <FileText className="h-3.5 w-3.5" />
              ) : selectedTemplate ? (
                <LayoutTemplate className="h-3.5 w-3.5" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              {hasExistingForTool
                ? 'Abrir Documento'
                : selectedTemplate
                ? 'Usar Template'
                : 'Criar em Branco'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
