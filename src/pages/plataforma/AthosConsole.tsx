import { useNavigate } from "react-router-dom";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { useProfile } from "@/hooks/useProfile";
import { useAthosAgentesOrg } from "@/hooks/useAthosAgentesOrg";
import { MASTER_ORG_ID } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Lock, ArrowRight, Zap, FileText } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import {
  ATHOS_AGENTS,
  ATHOS_CATEGORIAS,
  isAthosAgentLiberado,
  type AthosCategoria,
  type AthosAccessCtx,
} from "@/lib/athosAgents";

/**
 * Console Athos — visão única e client-facing de toda a inteligência que opera no CRM.
 * O Athos é a inteligência-guarda-chuva; o GS é o chat (destaque) e os demais são agentes.
 * Cada agente é clicável e abre sua página individual (`/crm/athos/:id`) com "como funciona" +
 * atividade própria. Não há mais feed de atividade global aqui — cada agente tem o seu.
 */
export default function AthosConsole() {
  const navigate = useNavigate();
  const { acesso } = usePlataforma();
  const { role, profile } = useProfile();
  const isSuperAdmin = role === "superadmin";
  const isMasterOrg = profile?.organization_id === MASTER_ORG_ID;
  const ctx: AthosAccessCtx = { acesso, isSuperAdmin, isMasterOrg };
  const { isAtivo, toggle } = useAthosAgentesOrg();

  const liberados = ATHOS_AGENTS.filter((a) => isAthosAgentLiberado(a, ctx));
  const gs = ATHOS_AGENTS.find((a) => a.id === "gs");
  const gsLiberado = gs ? isAthosAgentLiberado(gs, ctx) : false;

  const categorias: AthosCategoria[] = ["atendimento", "analise", "cs"];

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
      {/* HEADER */}
      <PageHero
        dataTutorial="athos-header"
        icon={Sparkles}
        title="Agentes de IA"
        subtitle={`A inteligência que opera na sua clínica. ${liberados.length} agente${liberados.length !== 1 ? "s" : ""} ativo${liberados.length !== 1 ? "s" : ""} para você. Clique em um agente para ver como ele trabalha.`}
        right={
          <Button
            variant="outline"
            onClick={() => navigate("/crm/materiais")}
            className="h-9 rounded-lg text-xs font-medium gap-1.5 shrink-0 bg-white/10 hover:bg-white/15 text-white border-white/15 hover:text-white"
          >
            <FileText className="h-3.5 w-3.5" /> Materiais
          </Button>
        }
      />

      {/* ATHOS GS — O CHAT EM DESTAQUE */}
      {gs && (
        <button
          onClick={() => gsLiberado && navigate(`/crm/athos/${gs.id}`)}
          disabled={!gsLiberado}
          className={`w-full text-left rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden group transition-colors ${
            gsLiberado ? "hover:bg-muted/20 cursor-pointer" : "opacity-60 cursor-not-allowed"
          }`}
          data-tutorial="athos-agent-card"
        >
          <div className="flex items-center gap-4 px-6 py-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              {gsLiberado ? <gs.icon className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-bold text-foreground font-display">{gs.nome}</p>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">Núcleo · Chat</span>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">{gs.beneficio}</p>
            </div>
            {gsLiberado && (
              <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-[#E85D24] group-hover:translate-x-0.5 transition-all shrink-0" />
            )}
          </div>
        </button>
      )}

      {/* AGENTES POR CATEGORIA — cada linha abre a página do agente */}
      {categorias.map((cat) => {
        // Agentes internos (admin) só aparecem na org master — nunca durante impersonação de cliente.
        const agentes = ATHOS_AGENTS.filter(
          (a) => a.categoria === cat && (a.gate.kind !== "admin" || (isSuperAdmin && isMasterOrg))
        );
        if (agentes.length === 0) return null;
        const meta = ATHOS_CATEGORIAS[cat];

        return (
          <section key={cat} className="space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{meta.label}</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">{meta.descricao}</p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden divide-y divide-border/40">
              {agentes.map((agent) => {
                const liberado = isAthosAgentLiberado(agent, ctx);
                const Icon = agent.icon;
                const ativo = agent.gateSlug ? isAtivo(agent.gateSlug) : true;
                const pausado = agent.enforced === true && liberado && !ativo;

                return (
                  <div
                    key={agent.id}
                    onClick={() => liberado && navigate(`/crm/athos/${agent.id}`)}
                    className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                      liberado ? "cursor-pointer hover:bg-muted/20 group" : "opacity-50 cursor-not-allowed"
                    }`}
                    data-tutorial="athos-agent-card"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${liberado && !pausado ? "bg-muted" : "bg-muted/50"}`}>
                      {liberado ? <Icon className={`w-4 h-4 ${pausado ? "text-muted-foreground/50" : "text-foreground"}`} /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold font-display ${liberado ? "text-foreground" : "text-muted-foreground"}`}>{agent.nome}</p>
                        <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">{agent.badge}</span>
                        {pausado && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">Pausado</span>
                        )}
                      </div>
                      <p className={`text-[13px] mt-0.5 ${liberado ? "text-muted-foreground" : "text-muted-foreground/50"}`}>{agent.beneficio}</p>
                    </div>

                    {/* On/off rápido dos agentes enforced (sem sair da lista) */}
                    {liberado && agent.enforced && agent.gateSlug && (
                      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={ativo}
                          onCheckedChange={(checked) => toggle.mutate({ slug: agent.gateSlug!, ativo: checked })}
                        />
                      </div>
                    )}

                    {/* Marcador de automático para os que não têm toggle */}
                    {liberado && !agent.enforced && agent.acao === "auto" && (
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 shrink-0">
                        <Zap className="w-3 h-3" /> Automático
                      </span>
                    )}

                    {liberado && (
                      <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-[#E85D24] group-hover:translate-x-0.5 transition-all shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
