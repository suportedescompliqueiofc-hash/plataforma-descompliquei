import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { useProfile } from "@/hooks/useProfile";
import { useAthosAgentesOrg } from "@/hooks/useAthosAgentesOrg";
import { useAthosEventos } from "@/hooks/useAthosEventos";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft, Lock, Settings, ArrowRight, Search, Sparkles,
} from "lucide-react";
import {
  getAthosAgentById,
  isAthosAgentLiberado,
  ATHOS_CATEGORIAS,
  type AthosAccessCtx,
} from "@/lib/athosAgents";
import { NonLeadAnalysisModal } from "@/components/conversations/NonLeadAnalysisModal";
import { AiFollowupTab } from "@/components/ai/AiFollowupTab";
import { AiTriageLogsTab } from "@/components/ai/AiTriageLogsTab";
import { AthosRecepcaoContent } from "./athos-agents/AthosRecepcaoContent";
import { MASTER_ORG_ID } from "@/lib/constants";

/**
 * Página individual de um agente Athos (`/crm/athos/:agentId`).
 *
 * Centraliza tudo sobre o agente num só lugar — config, logs, ações — antes espalhado em
 * `/crm/ia` (removida). Cada agente tem seu próprio conteúdo (`AthosRecepcaoContent`,
 * `AiTriageLogsTab`, `AiFollowupTab`, modal de Análise), não um template genérico repetido.
 *
 * Assinatura visual do hero: um "readout" mono (status / gatilho / atividade), no mesmo idioma
 * tipográfico já usado para números no resto do produto (font-display tabular-nums).
 */
export default function AthosAgentPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { acesso } = usePlataforma();
  const { role, profile } = useProfile();
  const isSuperAdmin = role === "superadmin";
  const isMasterOrg = profile?.organization_id === MASTER_ORG_ID;
  const ctx: AthosAccessCtx = { acesso, isSuperAdmin, isMasterOrg };
  const { isAtivo, toggle } = useAthosAgentesOrg();
  const [analiseModalOpen, setAnaliseModalOpen] = useState(false);

  const agent = getAthosAgentById(agentId);
  const liberado = agent ? isAthosAgentLiberado(agent, ctx) : false;

  // Readout compacto de atividade (30d) — número no hero; o detalhe completo vive no
  // conteúdo específico de cada agente (logs migrados de /crm/ia), não mais numa lista aqui.
  const { data: eventos = [], isLoading: eventosLoading } = useAthosEventos(
    agent?.logSlug ?? null,
    30,
  );

  if (!agent) {
    return (
      <div className="max-w-[900px] mx-auto py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">Agente não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/crm/athos")} className="mt-4 h-9 rounded-lg text-xs font-medium border-border/60 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao Athos
        </Button>
      </div>
    );
  }

  const Icon = agent.icon;
  const ativo = agent.gateSlug ? isAtivo(agent.gateSlug) : true;
  const pausado = agent.enforced === true && liberado && !ativo;
  const temLog = agent.logSlug !== null;
  const categoriaLabel = ATHOS_CATEGORIAS[agent.categoria]?.label ?? "Athos";

  // Readout de status — o "STATUS" que abre o painel do agente.
  let statusLabel: string;
  let statusClass: string;
  if (!liberado) {
    statusLabel = "Bloqueado";
    statusClass = "text-muted-foreground/60";
  } else if (agent.enforced) {
    statusLabel = ativo ? "Ativo" : "Pausado";
    statusClass = ativo ? "text-emerald-600" : "text-muted-foreground";
  } else {
    statusLabel = "Disponível";
    statusClass = "text-foreground";
  }

  return (
    <div className="max-w-[900px] mx-auto space-y-9 pb-14" data-tutorial="athos-agent">
      {/* VOLTAR */}
      <button
        onClick={() => navigate("/crm/athos")}
        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Athos
      </button>

      {/* HERO */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex items-start gap-4 px-6 pt-6 pb-5">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ring-black/5 ${
              liberado && !pausado ? "bg-foreground text-background" : "bg-muted"
            }`}
          >
            {liberado ? <Icon className={`h-6 w-6 ${pausado ? "text-muted-foreground" : ""}`} /> : <Lock className="h-6 w-6 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">
              Agente Athos · {categoriaLabel}
            </p>
            <h1 className="text-[26px] font-bold tracking-tight text-foreground font-display leading-tight">{agent.nome}</h1>
            <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed max-w-[580px]">{agent.resumo}</p>
          </div>
        </div>

        {/* READOUT — assinatura da página: status compacto em mono, como um painel de operação */}
        <div className={`grid ${temLog ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"} divide-x divide-border/40 border-t border-border/40`}>
          <div className="px-6 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Status</p>
            <p className={`text-[15px] sm:text-base font-bold font-mono uppercase tracking-tight mt-0.5 ${statusClass}`}>{statusLabel}</p>
          </div>
          <div className="px-6 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Gatilho</p>
            <p className="text-[15px] sm:text-base font-bold font-mono uppercase tracking-tight mt-0.5 text-foreground">{agent.modoGatilho}</p>
          </div>
          {temLog && (
            <div className="px-6 py-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Atividade (30d)</p>
              <p className="text-[15px] sm:text-base font-bold font-display tabular-nums mt-0.5 text-foreground">
                {eventosLoading ? "—" : `${eventos.length}${eventos.length === 30 ? "+" : ""}`}
              </p>
            </div>
          )}
        </div>

        {/* AÇÕES — controles do agente, sem texto redundante com o readout acima */}
        {liberado && (agent.enforced || agent.href) && (
          <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-border/40 bg-muted/20">
            {agent.href && agent.acao === "config" && (
              <button
                type="button"
                onClick={() => navigate(agent.href!)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings className="h-3.5 w-3.5" /> Configurar
              </button>
            )}
            {agent.href && agent.acao === "abrir" && (
              <button
                type="button"
                onClick={() => navigate(agent.href!)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Abrir <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            {agent.href && agent.acao === "copiloto" && (
              <Button
                onClick={() => navigate(agent.href!)}
                className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
              >
                Abrir chat <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {agent.enforced && agent.gateSlug && (
              <Switch
                checked={ativo}
                onCheckedChange={(checked) => toggle.mutate({ slug: agent.gateSlug!, ativo: checked })}
              />
            )}
          </div>
        )}
      </div>

      {!liberado && (
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-[13px] text-muted-foreground">Este agente não está incluído no seu plano atual.</p>
        </div>
      )}

      {/* CONTEÚDO ESPECÍFICO DO AGENTE — cada IA tem sua própria funcionalidade centralizada aqui */}
      {liberado && agent.id === "recepcao" && (
        <section data-tutorial="athos-agent-conteudo">
          <AthosRecepcaoContent />
        </section>
      )}

      {liberado && agent.id === "triagem" && (
        <section data-tutorial="athos-agent-conteudo">
          <AiTriageLogsTab />
        </section>
      )}

      {liberado && agent.id === "followup" && (
        <section data-tutorial="athos-agent-conteudo">
          <AiFollowupTab />
        </section>
      )}

      {liberado && agent.id === "analise" && (
        <section className="space-y-3" data-tutorial="athos-agent-conteudo">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Rodar análise</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Revise os contatos do período e limpe quem não é lead real</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted ring-1 ring-inset ring-black/5">
                <Search className="h-4 w-4 text-foreground" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Analisar contatos agora</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">Revisa até 50 contatos do período escolhido e aponta quem não é lead</p>
              </div>
            </div>
            <Button
              onClick={() => setAnaliseModalOpen(true)}
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5 shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" /> Iniciar análise
            </Button>
          </div>
          {profile?.organization_id && (
            <NonLeadAnalysisModal
              open={analiseModalOpen}
              onClose={() => setAnaliseModalOpen(false)}
              organizationId={profile.organization_id}
            />
          )}
        </section>
      )}

      {liberado && agent.id === "gs" && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            O Athos funciona por conversa — abra o chat para falar com ele.
          </p>
          {agent.href && (
            <Button onClick={() => navigate(agent.href!)} className="mt-3 h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5">
              Abrir chat <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
