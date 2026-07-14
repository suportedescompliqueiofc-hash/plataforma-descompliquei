import { useNavigate } from "react-router-dom";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { Button } from "@/components/ui/button";
import { Bot, MessageSquare, Search, Send, RefreshCw, Megaphone, Film, PenTool, Lock, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/PageHero";

const IA_LIST = [
  { id: 'preattendance', title: 'Pré-Atendimento', benefit: 'Zero lead perdido por demora na resposta', badge: 'Ativa 24h no WhatsApp', icon: Bot, requiredPlan: 'pca' },
  { id: 'objections', title: 'Objeções', benefit: 'Recepção nunca mais trava na hora que importa', badge: 'Na hora da objeção', icon: MessageSquare, requiredPlan: 'pca' },
  { id: 'analysis', title: 'Análise de Atendimento', benefit: 'Cada atendimento melhora com dados', badge: 'Diagnóstico de conversão', icon: Search, requiredPlan: 'pca' },
  { id: 'followup', title: 'Follow-Up', benefit: 'Zero lead esquecido no funil', badge: 'D+1, D+3, D+7', icon: Send, requiredPlan: 'pca' },
  { id: 'remarketing', title: 'Remarketing', benefit: 'Base inativa vira caixa todo mês', badge: 'Base antiga = dinheiro novo', icon: RefreshCw, requiredPlan: 'pca' },
  { id: 'campaign', title: 'Campanhas', benefit: 'Brief de anúncio pronto em minutos', badge: 'Exclusivo G.C.A.', icon: Megaphone, requiredPlan: 'gca' },
  { id: 'creative', title: 'Criativo', benefit: 'Roteiro de criativo pronto para gravar', badge: 'Exclusivo G.C.A.', icon: Film, requiredPlan: 'gca' },
  { id: 'content', title: 'Conteúdo', benefit: 'Calendário de conteúdo mensal por ICP', badge: 'Exclusivo G.C.A.', icon: PenTool, requiredPlan: 'gca' }
];

export default function IAHub() {
  const navigate = useNavigate();
  const { plan, acesso } = usePlataforma();
  const iasLiberadas = acesso.ias_liberadas ?? [];

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
      {/* HEADER */}
      <PageHero
        dataTutorial="iahub-header"
        icon={Bot}
        title="IAs Comerciais"
        subtitle={`${iasLiberadas.length} inteligência${iasLiberadas.length !== 1 ? 's artificiais' : ' artificial'} disponíve${iasLiberadas.length !== 1 ? 'is' : 'l'} para você.`}
      />

      {/* GRID DE IAS */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden divide-y divide-border/60">
        {IA_LIST.map((ia) => {
          const Icon = ia.icon;
          const isLocked = !iasLiberadas.includes(ia.id);

          return (
            <div
              key={ia.id}
              onClick={() => !isLocked && navigate(`/plataforma/ia-comercial/${ia.id}`)}
              className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                isLocked
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-muted/30 group'
              }`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isLocked ? 'bg-muted/50' : 'bg-muted'}`}>
                {isLocked ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Icon className="w-4 h-4 text-foreground" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-semibold font-display ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>{ia.title}</p>
                  <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                    {ia.badge}
                  </span>
                </div>
                <p className={`text-[13px] mt-0.5 ${isLocked ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>{ia.benefit}</p>
              </div>

              {!isLocked && (
                <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
