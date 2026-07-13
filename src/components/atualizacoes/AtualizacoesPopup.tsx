import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, Megaphone, Sparkles, TrendingUp, Wrench, ArrowRight, ChevronRight, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAtualizacoes, type Atualizacao } from "@/hooks/useAtualizacoes";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useNpsSurvey } from "@/hooks/useNpsSurvey";
import { useTutorialContext } from "@/components/tutorial/TutorialProvider";
import { renderRichText } from "@/lib/richText";
import type { CategoriaKey } from "@/lib/atualizacoesAreas";

const CATEGORIA_STYLE: Record<CategoriaKey, { bg: string; text: string; dot: string; icon: typeof Sparkles; label: string }> = {
  novidade: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", icon: Sparkles, label: "Novidade" },
  melhoria: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", icon: TrendingUp, label: "Melhoria" },
  correcao: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", icon: Wrench, label: "Correção" },
};

// Guarda até que ponto (quantas não-vistas) o usuário já postergou nesta sessão —
// não é "marcar como lido": se novas atualizações forem publicadas depois, o
// contador cresce de novo e o popup volta a aparecer.
const SESSION_KEY = "atualizacoes_popup_postponed_count";

export function AtualizacoesPopup() {
  const location = useLocation();
  const navigate = useNavigate();
  const { itensNaoVistos, naoVistosCount, marcarVistas } = useAtualizacoes();
  const { shouldShowModal: onboardingActive } = useOnboarding();
  const { pending: npsPending } = useNpsSurvey();
  const { startAdHocSpotlight } = useTutorialContext();
  const [index, setIndex] = useState(0);
  const [postponedCount, setPostponedCount] = useState(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });

  useEffect(() => {
    setIndex(0);
  }, [naoVistosCount]);

  const isExcludedRoute = location.pathname.startsWith("/admin") || location.pathname === "/login";
  const postponed = naoVistosCount <= postponedCount;

  if (isExcludedRoute || onboardingActive || npsPending || postponed) return null;
  if (naoVistosCount === 0) return null;

  const item = itensNaoVistos[index];
  if (!item) return null;

  const isLast = index === itensNaoVistos.length - 1;

  // Postergar: some por agora, mas SEM zerar o contador — o badge da sidebar
  // continua mostrando quantas atualizações faltam ver.
  const postpone = () => {
    sessionStorage.setItem(SESSION_KEY, String(naoVistosCount));
    setPostponedCount(naoVistosCount);
  };

  // Concluir: só marca TUDO como visto quando o usuário passou por todos os
  // itens do carrossel (ou pediu pra ver a lista completa) — nunca num único clique.
  const finish = () => {
    marcarVistas();
  };

  const handlePular = () => {
    if (isLast) {
      finish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const handleVerAgora = (item: Atualizacao) => {
    if (item.rota_destino) {
      navigate(item.rota_destino);
      if (item.tutorial_alvo) {
        setTimeout(() => startAdHocSpotlight({
          target: item.tutorial_alvo!,
          title: item.titulo,
          description: item.descricao,
          position: 'bottom',
        }), 600);
      }
    }
    if (isLast) {
      finish();
    } else {
      postpone();
    }
  };

  const handleVerTodas = () => {
    navigate('/crm/atualizacoes');
    postpone();
  };

  const style = CATEGORIA_STYLE[item.categoria];
  const Icon = style.icon;
  const progress = ((index + 1) / itensNaoVistos.length) * 100;

  return (
    <div className="fixed bottom-6 right-6 z-[60] w-[380px] rounded-2xl border border-border/60 bg-card shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300 flex flex-col max-h-[80vh]">
      <div className="px-5 pt-4 pb-3 border-b border-border/40 bg-muted/[0.03] shrink-0">
        <div className="flex items-start gap-2">
          <span className="p-1.5 rounded-lg bg-muted shrink-0">
            <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Novidades da plataforma</p>
            {itensNaoVistos.length > 1 && (
              <p className="text-[10px] text-muted-foreground/50 mt-0.5 tabular-nums">{index + 1} de {itensNaoVistos.length} novidades</p>
            )}
          </div>
          <button
            onClick={postpone}
            className="h-6 w-6 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title="Fechar por agora"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {itensNaoVistos.length > 1 && (
          <div className="h-1 rounded-full bg-muted/50 overflow-hidden mt-3">
            <div
              className="h-full rounded-full bg-foreground transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="px-5 py-4 space-y-3 overflow-y-auto">
        <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md", style.bg, style.text)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
          <Icon className="h-3 w-3" />
          {style.label}
        </span>
        <p className="text-sm font-bold text-foreground font-display">{item.titulo}</p>
        <div className="text-[12px] leading-[1.7] text-muted-foreground space-y-1.5">
          {renderRichText(item.descricao)}
        </div>
      </div>

      <div className="border-t border-border/40 bg-muted/20 shrink-0">
        <div className="flex items-center justify-between px-5 py-3.5 gap-2">
          <button
            onClick={handlePular}
            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLast ? "Concluir" : "Pular"}
            {!isLast && <ChevronRight className="h-3 w-3" />}
          </button>
          {item.rota_destino && (
            <Button
              className="h-8 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-4 gap-1.5"
              onClick={() => handleVerAgora(item)}
            >
              Ver agora
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <button
          onClick={handleVerTodas}
          className="w-full flex items-center justify-center gap-1.5 text-[10px] font-medium text-muted-foreground/60 hover:text-foreground border-t border-border/30 py-2 transition-colors"
        >
          <ListChecks className="h-3 w-3" />
          Ver todas as atualizações
        </button>
      </div>
    </div>
  );
}
