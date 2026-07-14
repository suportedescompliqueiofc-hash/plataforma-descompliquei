import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useNpsSurvey } from '@/hooks/useNpsSurvey';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useProfile } from '@/hooks/useProfile';

function npsColor(score: number) {
  if (score >= 9) return 'bg-emerald-500 text-white border-emerald-500';
  if (score >= 7) return 'bg-amber-400 text-white border-amber-400';
  return 'bg-red-500 text-white border-red-500';
}

// Templates de pergunta usam placeholders [variavel] (ex: [nome]) — mesma
// convenção de cs_templates. O CSM nunca copia/cola esse texto manualmente
// como faz com playbooks, então a substituição precisa acontecer aqui.
function interpolate(text: string, vars: Record<string, string>) {
  return text.replace(/\[([^\]]+)\]/g, (match, key) => vars[key.trim().toLowerCase()] ?? match);
}

type NpsTone = 'positivo' | 'neutro' | 'negativo';

const TONE_STYLES: Record<NpsTone, { bg: string; text: string; dot: string }> = {
  positivo: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  neutro: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  negativo: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

// Segue a mesma classificação Promotor(9-10)/Neutro(7-8)/Detrator(0-6) usada em
// todo o módulo de CS (ver conhecimento/operacional/cs/09-metricas-e-kpis.md).
function thankYouCopy(score: number | null): { title: string; description: string; tone: NpsTone } {
  if (score === null) {
    return { title: 'Obrigado por responder!', description: 'Sua opinião foi registrada e vai nos ajudar a melhorar.', tone: 'neutro' };
  }
  if (score >= 9) {
    return { title: 'Que ótimo saber disso!', description: 'Ficamos muito felizes com sua nota — continue contando com a gente.', tone: 'positivo' };
  }
  if (score >= 7) {
    return { title: 'Obrigado pela resposta!', description: 'Vamos continuar trabalhando para deixar sua experiência ainda melhor.', tone: 'neutro' };
  }
  return {
    title: 'Obrigado pela sinceridade',
    description: 'Sentimos muito que sua experiência não foi a melhor. Vamos usar esse retorno para melhorar — alguém do nosso time pode entrar em contato para entender melhor.',
    tone: 'negativo',
  };
}

export function NpsSurveyPopup() {
  const location = useLocation();
  const { pending, submitResponse, snooze } = useNpsSurvey();
  const { shouldShowModal: onboardingActive } = useOnboarding();
  const { profile } = useProfile();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [thankYou, setThankYou] = useState<{ score: number | null } | null>(null);

  useEffect(() => {
    setScores({});
    setTextos({});
  }, [pending?.campanhaId]);

  useEffect(() => {
    if (!thankYou) return;
    const timer = setTimeout(() => setThankYou(null), 7000);
    return () => clearTimeout(timer);
  }, [thankYou]);

  const isCrmRoute = location.pathname.startsWith('/crm');
  if (!isCrmRoute || onboardingActive) return null;
  if (!pending && !thankYou) return null;

  if (thankYou) {
    const copy = thankYouCopy(thankYou.score);
    const tone = TONE_STYLES[copy.tone];
    return (
      <div className="fixed bottom-6 right-6 z-[60] w-[380px] rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="px-5 py-5 flex items-start gap-3">
          <span className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', tone.bg)}>
            <span className={cn('h-2 w-2 rounded-full', tone.dot)} />
          </span>
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-bold font-display', tone.text)}>{copy.title}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{copy.description}</p>
          </div>
          <button
            onClick={() => setThankYou(null)}
            className="h-6 w-6 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (!pending) return null;

  const firstName = profile?.nome_completo?.trim().split(/\s+/)[0] || '';
  const vars = { nome: firstName };

  const allRequiredAnswered = pending.perguntas.every(p => {
    if (!p.obrigatoria) return true;
    return p.tipo === 'escala' ? scores[p.perguntaId] !== undefined : (textos[p.perguntaId] ?? '').trim().length > 0;
  });

  const handleSubmit = () => {
    if (!allRequiredAnswered) return;
    const respostas = pending.perguntas
      .filter(p => p.tipo === 'escala' ? scores[p.perguntaId] !== undefined : (textos[p.perguntaId] ?? '').trim().length > 0)
      .map(p => ({
        pergunta_id: p.perguntaId,
        valor_numero: p.tipo === 'escala' ? scores[p.perguntaId] : undefined,
        valor_texto: p.tipo === 'texto' ? textos[p.perguntaId] : undefined,
      }));
    const recomendacao = pending.perguntas.find(p => p.dimensao === 'recomendacao');
    const recomendacaoScore = recomendacao ? scores[recomendacao.perguntaId] ?? null : null;
    submitResponse.mutate(
      { campanhaId: pending.campanhaId, respostas },
      { onSuccess: () => setThankYou({ score: recomendacaoScore }) }
    );
  };

  const handleSnooze = () => {
    snooze.mutate({ campanhaId: pending.campanhaId, dias: 3 });
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] w-[380px] rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300 flex flex-col max-h-[80vh]">
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03] flex items-start gap-2 shrink-0">
        <span className="p-1.5 rounded-lg bg-muted shrink-0">
          <Star className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Pesquisa rápida</p>
        </div>
        <button
          onClick={handleSnooze}
          disabled={snooze.isPending}
          className="h-6 w-6 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors shrink-0"
          title="Agora não"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-5 overflow-y-auto">
        {pending.perguntas.map(p => {
          const texto = interpolate(p.texto, vars);
          return (
            <div key={p.perguntaId} className="space-y-2.5">
              <p className="text-sm font-medium text-foreground leading-snug">{texto}</p>
              {p.tipo === 'escala' ? (
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setScores(s => ({ ...s, [p.perguntaId]: i }))}
                      className={cn(
                        'w-7 h-7 rounded-lg text-xs font-semibold font-display tabular-nums border transition-all',
                        scores[p.perguntaId] === i ? npsColor(i) : 'border-border/60 text-muted-foreground hover:border-foreground/30'
                      )}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              ) : (
                <Textarea
                  value={textos[p.perguntaId] ?? ''}
                  onChange={e => setTextos(t => ({ ...t, [p.perguntaId]: e.target.value }))}
                  placeholder={p.obrigatoria ? 'Sua resposta...' : 'Sua resposta... (opcional)'}
                  rows={2}
                  className="text-sm rounded-lg border-border/60 resize-none"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/40 bg-muted/20 gap-2 shrink-0">
        <button
          onClick={handleSnooze}
          disabled={snooze.isPending}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Agora não
        </button>
        <Button
          className="h-8 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-4"
          disabled={!allRequiredAnswered || submitResponse.isPending}
          onClick={handleSubmit}
        >
          {submitResponse.isPending ? 'Enviando...' : 'Enviar'}
        </Button>
      </div>
    </div>
  );
}
