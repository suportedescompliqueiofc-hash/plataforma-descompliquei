import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, Sparkles, TrendingUp, Wrench, ArrowRight } from "lucide-react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/PageHero";
import { renderRichText } from "@/lib/richText";
import { useAtualizacoes, type Atualizacao } from "@/hooks/useAtualizacoes";
import { useTutorialContext } from "@/components/tutorial/TutorialProvider";
import { CATEGORIA_OPTIONS, type CategoriaKey } from "@/lib/atualizacoesAreas";

const CATEGORIA_STYLE: Record<CategoriaKey, { bg: string; text: string; dot: string; icon: typeof Sparkles }> = {
  novidade: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", icon: Sparkles },
  melhoria: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", icon: TrendingUp },
  correcao: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", icon: Wrench },
};

const CATEGORIA_ORDEM: CategoriaKey[] = ["novidade", "melhoria", "correcao"];

function formatGrupoData(date: Date): string {
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  const mesmoAno = date.getFullYear() === new Date().getFullYear();
  return format(date, mesmoAno ? "d 'de' MMMM" : "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

interface GrupoData {
  dataKey: string;
  dataLabel: string;
  porCategoria: Partial<Record<CategoriaKey, Atualizacao[]>>;
}

function agruparPorData(itens: Atualizacao[]): GrupoData[] {
  const mapa = new Map<string, Atualizacao[]>();
  for (const item of itens) {
    const key = format(new Date(item.publicado_em), "yyyy-MM-dd");
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key)!.push(item);
  }
  return Array.from(mapa.entries()).map(([dataKey, grupoItens]) => {
    const porCategoria: Partial<Record<CategoriaKey, Atualizacao[]>> = {};
    for (const cat of CATEGORIA_ORDEM) {
      const doCategoria = grupoItens.filter((i) => i.categoria === cat);
      if (doCategoria.length > 0) porCategoria[cat] = doCategoria;
    }
    return {
      dataKey,
      dataLabel: formatGrupoData(new Date(grupoItens[0].publicado_em)),
      porCategoria,
    };
  });
}

function AtualizacaoCard({ item, onVerAgora }: { item: Atualizacao; onVerAgora: (item: Atualizacao) => void }) {
  const style = CATEGORIA_STYLE[item.categoria];
  const Icon = style.icon;
  const timeAgo = formatDistanceToNow(new Date(item.publicado_em), { addSuffix: true, locale: ptBR });

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md", style.bg, style.text)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
            <Icon className="h-3 w-3" />
            {CATEGORIA_OPTIONS.find(c => c.key === item.categoria)?.label}
          </span>
          <span className="text-[11px] text-muted-foreground/50 tabular-nums ml-auto shrink-0">{timeAgo}</span>
        </div>
        <h3 className="text-sm font-bold text-foreground font-display">{item.titulo}</h3>
        <div className="text-[13px] leading-[1.7] text-muted-foreground space-y-1.5">
          {renderRichText(item.descricao)}
        </div>
        {item.rota_destino && (
          <Button
            onClick={() => onVerAgora(item)}
            className="h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 px-3 gap-1.5 mt-1"
          >
            Ver agora
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Atualizacoes() {
  const navigate = useNavigate();
  const { itens, isLoading, marcarVistas } = useAtualizacoes();
  const { startAdHocSpotlight } = useTutorialContext();
  const [activeTab, setActiveTab] = useState<CategoriaKey | "todas">("todas");

  useEffect(() => {
    if (itens.length > 0) marcarVistas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens.length]);

  const counts = useMemo(() => ({
    todas: itens.length,
    novidade: itens.filter(i => i.categoria === "novidade").length,
    melhoria: itens.filter(i => i.categoria === "melhoria").length,
    correcao: itens.filter(i => i.categoria === "correcao").length,
  }), [itens]);

  const filtrados = activeTab === "todas" ? itens : itens.filter(i => i.categoria === activeTab);
  const grupos = useMemo(() => agruparPorData(filtrados), [filtrados]);

  const handleVerAgora = (item: Atualizacao) => {
    if (!item.rota_destino) return;
    navigate(item.rota_destino);
    if (item.tutorial_alvo) {
      setTimeout(() => startAdHocSpotlight({
        target: item.tutorial_alvo!,
        title: item.titulo,
        description: item.descricao,
        position: 'bottom',
      }), 600);
    }
  };

  return (
    <div className="space-y-6 pb-10 max-w-full overflow-hidden">
      <PageHero
        icon={Megaphone}
        title="Atualizações"
        subtitle="Tudo o que mudou na plataforma"
      />

      <div data-tutorial="atualizacoes-tabs" className="flex items-center bg-muted/40 rounded-xl p-1 w-fit flex-wrap">
        {(["todas", ...CATEGORIA_OPTIONS.map(c => c.key)] as const).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200",
              activeTab === key ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {key === "todas" ? "Todas" : CATEGORIA_OPTIONS.find(c => c.key === key)?.label}
            <span className={cn(
              "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md",
              activeTab === key ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
            )}>
              {isLoading ? "..." : counts[key]}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtrados.length > 0 ? (
        <div data-tutorial="atualizacoes-list" className="space-y-8">
          {grupos.map(grupo => (
            <section key={grupo.dataKey} className="space-y-5">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 whitespace-nowrap">
                  {grupo.dataLabel}
                </p>
                <div className="h-px flex-1 bg-border/40" />
              </div>
              {CATEGORIA_ORDEM.map(cat => {
                const catItens = grupo.porCategoria[cat];
                if (!catItens) return null;
                const style = CATEGORIA_STYLE[cat];
                return (
                  <div key={cat} className="space-y-3">
                    {activeTab === "todas" && (
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                        <p className="text-[11px] font-bold uppercase tracking-wide text-foreground/70">
                          {CATEGORIA_OPTIONS.find(c => c.key === cat)?.label}
                        </p>
                        <span className="text-[10px] text-muted-foreground/40 tabular-nums">{catItens.length}</span>
                      </div>
                    )}
                    {catItens.map(item => (
                      <AtualizacaoCard key={item.id} item={item} onVerAgora={handleVerAgora} />
                    ))}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-xl bg-muted/40 mb-3">
            <Megaphone className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma atualização por aqui ainda</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5">Novidades da plataforma vão aparecer nesta página</p>
        </div>
      )}
    </div>
  );
}
