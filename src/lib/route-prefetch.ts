/**
 * Prefetch dos chunks de rota.
 *
 * O code splitting derrubou o bundle inicial de 7 MB para 1,8 MB, mas cobrou um
 * "piscar" na PRIMEIRA visita a cada rota — o chunk só começava a baixar no
 * clique. Duas defesas, nesta ordem de eficácia:
 *
 * 1. `prefetchRota(path)` no `onMouseEnter` do link da sidebar. Ganha os
 *    200-500 ms entre o ponteiro tocar o link e o clique acontecer. É o que
 *    realmente zera a espera, inclusive para chunks grandes (Leads tem 452 kB).
 * 2. `prefetchRotasFrequentes()` em `requestIdleCallback`, em série, como rede
 *    de segurança para quem navega por teclado ou por URL direta.
 *
 * `import()` é idempotente — chamar de novo devolve o módulo já carregado.
 *
 * FORA daqui de propósito: /crm/canvas, que arrasta o Excalidraw (~2 MB). Não
 * vale baixar no escuro para todo mundo por uma tela de uso esporádico; ela
 * mantém o spinner na primeira visita, e isso é uma troca consciente.
 */

type Loader = () => Promise<unknown>;

export const ROTA_LOADERS: Record<string, Loader> = {
  "/crm": () => import("@/pages/Dashboard"),
  "/crm/conversas": () => import("@/pages/Conversas"),
  "/crm/leads": () => import("@/pages/Leads"),
  "/crm/agendamentos": () => import("@/pages/Agendamentos"),
  "/crm/vendas": () => import("@/pages/Vendas"),
  "/crm/notificacoes": () => import("@/pages/Notifications"),
  "/crm/metas": () => import("@/pages/Metas"),
  "/crm/performance": () => import("@/pages/Performance"),
  "/crm/procedimentos": () => import("@/pages/Procedimentos"),
  "/crm/equipe": () => import("@/pages/Equipe"),
  "/crm/cadences": () => import("@/pages/Cadences"),
  "/crm/criativos": () => import("@/pages/CriativosBiblioteca"),
  "/crm/marketing-trafego": () => import("@/pages/MarketingTrafego"),
  "/crm/atualizacoes": () => import("@/pages/Atualizacoes"),
  "/crm/settings": () => import("@/pages/Settings"),
  "/crm/onboarding": () => import("@/pages/CrmOnboarding"),
  "/crm/super-admin-crm": () => import("@/pages/SuperAdmin"),
  "/crm/athos": () => import("@/pages/plataforma/AthosConsole"),
  "/crm/materiais": () => import("@/pages/plataforma/AthosMateriais"),
  "/crm/notas": () => import("@/pages/plataforma/Notas"),
  "/crm/evolucao": () => import("@/pages/plataforma/Evolucao"),
  "/plataforma": () => import("@/pages/plataforma/Hub"),
  "/plataforma/athos-gs": () => import("@/pages/plataforma/DescompliqueiOS"),
  "/plataforma/jornada": () => import("@/pages/plataforma/Jornada"),
  "/plataforma/sessoes-taticas": () => import("@/pages/plataforma/SessoesTaticas"),
};

const jaPedidas = new Set<string>();

/** Dispara o download do chunk da rota. Seguro chamar várias vezes. */
export function prefetchRota(path?: string | null): Promise<unknown> {
  if (!path) return Promise.resolve();
  const carregar = ROTA_LOADERS[path];
  if (!carregar || jaPedidas.has(path)) return Promise.resolve();
  jaPedidas.add(path);
  // Falha de rede aqui é irrelevante: a rota carrega normalmente no clique.
  // Solta o path do Set para que uma tentativa futura possa reagendar.
  return carregar().catch(() => { jaPedidas.delete(path); });
}

/**
 * Baixa tudo em série, na ordem do objeto (mais usadas primeiro).
 * Em série de propósito: em paralelo, 20+ chunks competiriam por banda com as
 * requisições da tela que a pessoa está usando agora.
 */
export function prefetchRotasFrequentes() {
  Object.keys(ROTA_LOADERS).reduce(
    (fila, path) => fila.then(() => prefetchRota(path)),
    Promise.resolve() as Promise<unknown>,
  );
}
