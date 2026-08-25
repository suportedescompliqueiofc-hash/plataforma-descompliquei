import { useState, useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useParams, Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useWhatsAppMonitor } from "@/hooks/useWhatsAppMonitor";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { AppChromeProvider, useAppChrome } from "@/contexts/AppChromeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlataformaGuard } from "@/components/PlataformaGuard";
import { Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound"; // estático: é o fallback, buscar chunk p/ 404 não faz sentido

// Toda página é carregada sob demanda. Antes eram 65 imports estáticos e ZERO
// lazy: quem abria a tela de login baixava as 112 páginas, o painel de admin
// inteiro e o Outbound junto. Cada `lazy` vira um chunk próprio, buscado só
// quando a rota é visitada. O <Suspense> que envolve <Routes> cobre a espera.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const Settings = lazy(() => import("./pages/Settings"));
const Conversations = lazy(() => import("./pages/Conversas"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Vendas = lazy(() => import("./pages/Vendas"));
const Cadences = lazy(() => import("./pages/Cadences"));
const MarketingTrafego = lazy(() => import("./pages/MarketingTrafego"));
const Agendamentos = lazy(() => import("./pages/Agendamentos"));
const Metas = lazy(() => import("./pages/Metas"));
const Equipe = lazy(() => import("./pages/Equipe"));
const Performance = lazy(() => import("./pages/Performance"));
const Procedimentos = lazy(() => import("./pages/Procedimentos"));
const JornadaPaciente = lazy(() => import("./pages/JornadaPaciente"));
const CriativosBiblioteca = lazy(() => import("./pages/CriativosBiblioteca"));
const CriativosPasta = lazy(() => import("./pages/CriativosPasta"));
const Canvas = lazy(() => import("./pages/Canvas"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
import { TutorialProvider } from "./components/tutorial/TutorialProvider";
import { TutorialSpotlight } from "./components/tutorial/TutorialSpotlight";
import { TutorialHelpCenter } from "./components/tutorial/TutorialHelpCenter";
import { OnboardingModal } from "./components/onboarding/OnboardingModal";
import { MemberWelcomeModal } from "./components/onboarding/MemberWelcomeModal";
import { NpsSurveyPopup } from "./components/nps/NpsSurveyPopup";
import { OnboardingPlataformaChecklist } from "./components/plataforma/OnboardingPlataformaChecklist";
import OnboardingPlataformaModal from "./components/plataforma/OnboardingPlataformaModal";
import { AtualizacoesPopup } from "./components/atualizacoes/AtualizacoesPopup";
const CrmOnboarding = lazy(() => import("./pages/CrmOnboarding"));
const Atualizacoes = lazy(() => import("./pages/Atualizacoes"));
const AdminAtualizacoes = lazy(() => import("./pages/admin-os/pages/AdminAtualizacoes"));

// Outbound pages
import { OutboundLayout } from "./components/outbound/OutboundLayout";
const OutboundPainel = lazy(() => import("./pages/outbound/OutboundPainel"));
const OutboundProspectos = lazy(() => import("./pages/outbound/OutboundProspectos"));
const OutboundPipeline = lazy(() => import("./pages/outbound/OutboundPipeline"));
const OutboundLigacoes = lazy(() => import("./pages/outbound/OutboundLigacoes"));
const OutboundAgendamentos = lazy(() => import("./pages/outbound/OutboundAgendamentos"));
const OutboundConversas = lazy(() => import("./pages/outbound/OutboundConversas"));
const OutboundVendas = lazy(() => import("./pages/outbound/OutboundVendas"));
const OutboundScripts = lazy(() => import("./pages/outbound/OutboundScripts"));
const OutboundCadencias = lazy(() => import("./pages/outbound/OutboundCadencias"));
const OutboundMetas = lazy(() => import("./pages/outbound/OutboundMetas"));
const OutboundConfiguracoes = lazy(() => import("./pages/outbound/OutboundConfiguracoes"));

// Admin OS — só superadmin entra aqui, não deve pesar no bundle de ninguém
import AdminGuard from "./pages/admin-os/AdminGuard";
import AdminLayout from "./pages/admin-os/AdminLayout";
const AdminDashboard = lazy(() => import("./pages/admin-os/pages/AdminDashboard"));
const AdminClientes = lazy(() => import("./pages/admin-os/pages/AdminClientes"));
const AdminClientePerfil = lazy(() => import("./pages/admin-os/pages/AdminClientePerfil"));
const AdminIAs = lazy(() => import("./pages/admin-os/pages/AdminIAs"));
const AdminSessoes = lazy(() => import("./pages/admin-os/pages/AdminSessoes"));
const AdminSistema = lazy(() => import("./pages/admin-os/pages/AdminSistema"));
const AdminSuporte = lazy(() => import("./pages/admin-os/pages/AdminSuporte"));
const AdminProdutos = lazy(() => import("./pages/admin-os/pages/AdminProdutos"));
const AdminAthos = lazy(() => import("./pages/admin-os/pages/AdminAthos"));
const AdminCS = lazy(() => import("./pages/admin-os/pages/AdminCS"));
const AdminCSCliente = lazy(() => import("./pages/admin-os/pages/AdminCSCliente"));
const AdminCSJornada = lazy(() => import("./pages/admin-os/pages/AdminCSJornada"));
const AdminCSJornadaEditor = lazy(() => import("./pages/admin-os/pages/AdminCSJornadaEditor"));
const AdminAcessoCliente = lazy(() => import("./pages/admin-os/pages/AdminAcessoCliente"));
import { AcessoGuard } from "./components/AcessoGuard";
import { OnboardingGuard } from "./components/plataforma/OnboardingGuard";
import { CrmGuard } from "./components/CrmGuard";
import { getRedirectDestino } from "./utils/redirectUtils";
import { DashboardLeadsModalProvider, useDashboardLeadsModal } from "./contexts/DashboardLeadsModalContext";
import { DashboardLeadsModal } from "./components/dashboard/DashboardLeadsModal";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SidebarContent } from "@/components/layout/SidebarContent";
import { useLocalStorage } from "./hooks/use-local-storage";
import { useProfile } from "./hooks/useProfile";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { cn } from "./lib/utils";
import { MASTER_ORG_ID } from "./lib/constants";

// Componentes da Plataforma
const Hub = lazy(() => import("./pages/plataforma/Hub"));
const Jornada = lazy(() => import("./pages/plataforma/Jornada"));
const JornadaEstagio = lazy(() => import("./pages/plataforma/JornadaEstagio"));
const DescompliqueiOS = lazy(() => import("./pages/plataforma/DescompliqueiOS"));
const AthosConsole = lazy(() => import("./pages/plataforma/AthosConsole"));
const AthosAgentPage = lazy(() => import("./pages/plataforma/AthosAgentPage"));
const AthosMateriais = lazy(() => import("./pages/plataforma/AthosMateriais"));
const Notas = lazy(() => import("./pages/plataforma/Notas"));
const SessoesTaticas = lazy(() => import("./pages/plataforma/SessoesTaticas"));
const Onboarding = lazy(() => import("./pages/plataforma/Onboarding"));
const OnboardingAthos = lazy(() => import("./pages/plataforma/OnboardingAthos"));
const Evolucao = lazy(() => import("./pages/plataforma/Evolucao"));
const PlataformaLogin = lazy(() => import("./pages/plataforma/PlataformaLogin"));
import { PlataformaProvider } from "@/contexts/PlataformaContext";
import { AthosOSProvider } from "@/contexts/AthosOSContext";

/**
 * Intercepta erros de autenticação vindos no hash da URL (ex: magic link expirado).
 * Supabase redireciona com /#error=access_denied&error_code=otp_expired&...
 * Sem este interceptor, a app crasha (sem sessão + componentes que esperam user).
 */
function AuthHashErrorInterceptor({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes('error=')) return;

    const params = new URLSearchParams(hash.replace('#', ''));
    const errorCode = params.get('error_code') || params.get('error') || '';

    // Limpa o hash para não reprocessar
    window.history.replaceState(null, '', window.location.pathname);

    (async () => {
      // Um magic link é de uso único: se a pessoa clicar duas vezes no mesmo
      // link (ex.: pelo e-mail de novo), a 1ª tentativa loga normalmente e a
      // 2ª cai aqui com "otp_expired" mesmo já havendo sessão válida no navegador.
      // Nesse caso não faz sentido mandar pra tela de erro — segue pro app.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return;

      // Mapeia códigos de erro para mensagens amigáveis
      let msgKey = 'link-invalido';
      if (errorCode === 'otp_expired') msgKey = 'link-expirado';
      else if (errorCode === 'access_denied') msgKey = 'acesso-negado';

      // Redireciona para login com a mensagem
      window.location.href = `/login?msg=${msgKey}`;
    })();
  }, [location]);

  return <>{children}</>;
}

const RedirectParam = ({ to }: { to: string }) => {
  const params = useParams();
  const resolved = Object.entries(params).reduce(
    (path, [key, val]) => path.replace(`:${key}`, val ?? ''),
    to
  );
  return <Navigate to={resolved} replace />;
};

// OTIMIZAÇÃO: Cache global de 5 minutos e desativação de recarregamento em background
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos de cache em memória
      refetchOnWindowFocus: false, // Previne lentidão ao alternar abas do navegador
      retry: 1, // Limita tentativas falhas para não travar a UI
    },
  },
});

function RootRedirect() {
  const { user, loading: authLoading } = useAuth();
  const { acesso, isContextLoading, isMember } = usePlataforma();
  const { role, isLoading: isLoadingProfile } = useProfile();
  const [timedOut, setTimedOut] = useState(false);

  const isStillLoading = authLoading || (user && (isContextLoading || isLoadingProfile));

  useEffect(() => {
    if (!isStillLoading) return;
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [isStillLoading]);

  if (isStillLoading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role === 'superadmin') return <Navigate to="/admin" replace />;
  // Membros da equipe sempre vão para o CRM — não têm acesso à plataforma
  if (isMember) return <Navigate to="/crm" replace />;
  return <Navigate to={getRedirectDestino(acesso)} replace />;
}

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <AppChromeProvider>
    <AppLayoutInner>{children}</AppLayoutInner>
  </AppChromeProvider>
);

const AppLayoutInner = ({ children }: { children: React.ReactNode }) => {
  const { chromeHidden } = useAppChrome();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage('sidebar-collapsed', false);
  const { modal, closeModal } = useDashboardLeadsModal();
  const location = useLocation();
  const isConversationsPage = location.pathname.startsWith('/crm/conversas') || location.pathname.startsWith('/outbound/conversas') || location.pathname.startsWith('/plataforma/athos-gs') || location.pathname.startsWith('/crm/notas');
  const isPlataformaRoute = location.pathname.startsWith('/plataforma');

  // Usar hook para verificar se é superadmin
  const { role, profile } = useProfile();
  const { diasRestantes } = usePlataforma();
  const [isReturning, setIsReturning] = useState(false);
  const isSuperAdmin = role === 'superadmin';
  const { status: waStatus } = useWhatsAppMonitor();
  const waDisconnected = waStatus === 'disconnected' && !isPlataformaRoute;
  
  // Impersonação: detectada APENAS quando o fluxo de "Acessar CRM" salvou a org original no localStorage
  // Isso permite que múltiplos superadmins tenham orgs diferentes sem falso positivo
  const originalOrgId = typeof window !== 'undefined' ? localStorage.getItem('original_master_org_id') : null;
  const isImpersonating = isSuperAdmin && !!originalOrgId;
  const showBanner = isImpersonating;

  const handleReturnToMaster = async () => {
    try {
      setIsReturning(true);

      if (!originalOrgId) {
        throw new Error('Organização original não encontrada. Faça logout e login novamente.');
      }

      if (!profile?.id) {
        throw new Error('Perfil não encontrado. Recarregue a página.');
      }

      const { error } = await supabase
        .from('perfis')
        .update({ organization_id: originalOrgId as any })
        .eq('id', profile.id);

      if (error) throw error;

      localStorage.removeItem('original_master_org_id');

      toast.success('Sessão restaurada. Retornando...');
      setTimeout(() => {
        window.location.href = '/crm';
      }, 1000);

    } catch (err: any) {
      toast.error('Erro ao retornar: ' + err.message);
      setIsReturning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden flex flex-col">
      {!chromeHidden && isPlataformaRoute && diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 7 && (
        <div className="bg-[#E85D24] text-white text-xs sm:text-sm font-medium py-2 px-4 text-center z-[60] relative">
          <strong>Seu acesso expira em {diasRestantes === 0 ? 'hoje' : `${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}`}.</strong> Entre em contato para renovar.
        </div>
      )}
      {!chromeHidden && waDisconnected && (
        <div className="bg-red-600 text-white text-xs sm:text-sm font-medium py-2.5 px-4 text-center z-[60] relative flex items-center justify-center gap-3">
          <span className="h-2 w-2 rounded-full bg-white/70 animate-pulse shrink-0" />
          <span><strong>WhatsApp desconectado.</strong> Sua conexão com o WhatsApp caiu e as mensagens não estão sendo recebidas.</span>
          <a
            href="/crm/settings?section=whatsapp"
            className="underline underline-offset-2 font-semibold hover:text-white/80 transition-colors shrink-0"
          >
            Reconectar agora
          </a>
        </div>
      )}
      {!chromeHidden && (
        <div className="hidden lg:block relative">
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>
      )}

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-[280px] bg-sidebar border-r-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {!chromeHidden && (
        <Header
          onMenuClick={() => setMobileMenuOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
        />
      )}
      <main className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        !chromeHidden && "pt-16",
        !chromeHidden && (isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64')
      )}>
        <div className={cn(
          "w-full max-w-full overflow-x-hidden flex-1",
          !isConversationsPage && !chromeHidden && "p-4 sm:p-6"
        )}>
          {children}
        </div>
      </main>

      {/* Modal de leads do dashboard — renderizado aqui para persistir entre rotas */}
      {modal && (
        <DashboardLeadsModal
          open={!!modal}
          onClose={closeModal}
          title={modal.title}
          leads={modal.leads}
          context={modal.context}
        />
      )}
    </div>
  );
};

/**
 * Fallback de rota: um respiro no lugar do conteúdo, NUNCA a tela inteira.
 * Fica dentro do AppLayout de propósito — sidebar e header continuam montados
 * enquanto o chunk da página baixa. Com o Suspense em volta do <Routes> inteiro,
 * o app piscava como se tivesse recarregado a cada primeira visita a uma rota.
 */
const ConteudoCarregando = () => (
  <div className="flex items-center justify-center py-24">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
  </div>
);

/** Layout route version of AppLayout — persists sidebar across route changes */
const AppLayoutRoute = () => (
  <AppLayout>
    <Suspense fallback={<ConteudoCarregando />}>
      <Outlet />
    </Suspense>
  </AppLayout>
);

/**
 * Baixa em segundo plano os chunks das páginas do dia a dia assim que o
 * navegador fica ocioso. O code splitting deixou o bundle inicial 75% menor,
 * mas cobrava um "piscar" na PRIMEIRA visita de cada rota — com o prefetch o
 * chunk já está em cache quando a pessoa clica, e o ganho vem sem o custo.
 * `import()` é idempotente: chamar de novo reaproveita o módulo já carregado.
 */
const prefetchRotasFrequentes = () => {
  const rotas = [
    () => import("./pages/Dashboard"),
    () => import("./pages/Leads"),
    () => import("./pages/Conversas"),
    () => import("./pages/Agendamentos"),
    () => import("./pages/Vendas"),
    () => import("./pages/Notifications"),
    () => import("./pages/Metas"),
    () => import("./pages/Performance"),
  ];
  // Em série, para não competir por banda com as requisições da tela atual.
  rotas.reduce(
    (fila, carregar) => fila.then(() => carregar().then(() => undefined, () => undefined)),
    Promise.resolve(),
  );
};

function PrefetchDeRotas() {
  useEffect(() => {
    const agendar = (window as any).requestIdleCallback
      ?? ((fn: () => void) => setTimeout(fn, 2000));
    const id = agendar(prefetchRotasFrequentes, { timeout: 5000 });
    return () => (window as any).cancelIdleCallback?.(id);
  }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthHashErrorInterceptor>
        <AuthProvider>
          <BrandingProvider>
            <PlataformaProvider>
              <DashboardLeadsModalProvider>
              <TutorialProvider>
              <TutorialSpotlight />
              <TutorialHelpCenter />
              <OnboardingModal />
              <MemberWelcomeModal />
              <NpsSurveyPopup />
              <OnboardingPlataformaModal />
              <OnboardingPlataformaChecklist />
              <AtualizacoesPopup />
              <PrefetchDeRotas />
              <AthosOSProvider>
              <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center bg-background">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }>
              <Routes>
            {/* CRM — AppLayout persiste, CrmGuard só controla o conteúdo */}
            <Route path="/crm/login" element={<Navigate to="/login" replace />} />
            <Route path="/" element={<RootRedirect />} />
            <Route element={<AppLayoutRoute />}>
              <Route element={<CrmGuard />}>
                <Route path="/crm" element={<Dashboard />} />
                <Route path="/crm/leads" element={<Leads />} />
                <Route path="/crm/agendamentos" element={<Agendamentos />} />
                <Route path="/crm/cadences" element={<Cadences />} />
                <Route path="/crm/ia" element={<Navigate to="/crm/athos/recepcao" replace />} />
                <Route path="/crm/athos" element={<AthosConsole />} />
                <Route path="/crm/athos/:agentId" element={<AthosAgentPage />} />
                <Route path="/crm/notas" element={<Notas />} />
                {/* Página antiga, ainda viva: guarda o Diagnóstico Estratégico do onboarding
                    e o espelho das construções salvas em meus_materiais — não migrados
                    para "paginas" nesta fase. Fora da sidebar, mas continua acessível. */}
                <Route path="/crm/materiais" element={<AthosMateriais />} />
                <Route path="/crm/conversas" element={<Conversations />} />
                <Route path="/crm/conversas/:leadId" element={<Conversations />} />
                <Route path="/crm/notificacoes" element={<Notifications />} />
                <Route path="/crm/vendas" element={<Vendas />} />
                <Route path="/crm/metas" element={<Metas />} />
                <Route path="/crm/equipe" element={<Equipe />} />
                <Route path="/crm/evolucao" element={<Evolucao />} />
                <Route path="/crm/performance" element={<Performance />} />
                <Route path="/crm/onboarding" element={<CrmOnboarding />} />
                <Route path="/crm/procedimentos" element={<Procedimentos />} />
                <Route path="/crm/leads/:leadId" element={<JornadaPaciente />} />
                <Route path="/crm/marketing-trafego" element={<MarketingTrafego />} />
                <Route path="/crm/criativos" element={<CriativosBiblioteca />} />
                <Route path="/crm/criativos/:pastaId" element={<CriativosPasta />} />
                <Route path="/crm/canvas" element={<Canvas />} />
                <Route path="/crm/super-admin-crm" element={<SuperAdmin />} />
              </Route>

              {/* Configurações — sempre acessível, independente de produto/entitlement (perfil, senha, plano) */}
              <Route element={<ProtectedRoute />}>
                <Route path="/crm/settings" element={<Settings />} />
                <Route path="/crm/atualizacoes" element={<Atualizacoes />} />
              </Route>

              {/* Outbound — Prospecção Ativa (Descompliquei) */}
              <Route element={<ProtectedRoute />}>
              <Route element={<OutboundLayout />}>
                <Route path="/outbound/painel" element={<OutboundPainel />} />
                <Route path="/outbound/prospectos" element={<OutboundProspectos />} />
                <Route path="/outbound/pipeline" element={<OutboundPipeline />} />
                <Route path="/outbound/ligacoes" element={<OutboundLigacoes />} />
                <Route path="/outbound/agendamentos" element={<OutboundAgendamentos />} />
                <Route path="/outbound/conversas" element={<OutboundConversas />} />
                <Route path="/outbound/conversas/:leadId" element={<OutboundConversas />} />
                <Route path="/outbound/vendas" element={<OutboundVendas />} />
                <Route path="/outbound/scripts" element={<OutboundScripts />} />
                <Route path="/outbound/cadencias" element={<OutboundCadencias />} />
                <Route path="/outbound/metas" element={<OutboundMetas />} />
                <Route path="/outbound/configuracoes" element={<OutboundConfiguracoes />} />
              </Route>
              </Route>
            </Route>
            {/* Legados CRM */}
            <Route path="/login" element={<PlataformaLogin />} />
            <Route path="/leads" element={<Navigate to="/crm/leads" replace />} />
            <Route path="/quick-messages" element={<Navigate to="/crm" replace />} />
            <Route path="/cadences" element={<Navigate to="/crm/cadences" replace />} />
            <Route path="/ia" element={<Navigate to="/crm/athos/recepcao" replace />} />
            <Route path="/settings" element={<Navigate to="/crm/settings" replace />} />
            <Route path="/conversas" element={<Navigate to="/crm/conversas" replace />} />
            <Route path="/conversas/:leadId" element={<RedirectParam to="/crm/conversas/:leadId" />} />
            <Route path="/notificacoes" element={<Navigate to="/crm/notificacoes" replace />} />
            <Route path="/vendas" element={<Navigate to="/crm/vendas" replace />} />
            <Route path="/super-admin-crm" element={<Navigate to="/crm/super-admin-crm" replace />} />
            {/* Admin OS — sidebar layout próprio, sem AppLayout */}
            <Route element={<AdminGuard />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/athos" element={<AdminAthos />} />
                <Route path="/admin/clientes" element={<AdminClientes />} />
                <Route path="/admin/clientes/:id" element={<AdminClientePerfil />} />
                <Route path="/admin/cs" element={<AdminCS />} />
                <Route path="/admin/cs/cliente/:clientId" element={<AdminCSCliente />} />
                <Route path="/admin/cs/cliente/:clientId/jornada" element={<AdminCSJornada />} />
                <Route path="/admin/cs/jornada/:jornadaId/editar" element={<AdminCSJornadaEditor />} />
                <Route path="/admin/ias" element={<AdminIAs />} />
                <Route path="/admin/sessoes" element={<AdminSessoes />} />
                <Route path="/admin/sistema" element={<AdminSistema />} />
                <Route path="/admin/suporte" element={<AdminSuporte />} />
                <Route path="/admin/acessos/:orgId" element={<AdminAcessoCliente />} />
                <Route path="/admin/produtos" element={<AdminProdutos />} />
                <Route path="/admin/atualizacoes" element={<AdminAtualizacoes />} />
              </Route>
            </Route>
            {/* Plataforma — AppLayout persiste, PlataformaGuard só controla o conteúdo */}
            <Route path="/plataforma/login" element={<Navigate to="/login" replace />} />
            <Route element={<AppLayoutRoute />}>
              <Route element={<PlataformaGuard />}>
                {/* Rotas sem restrição de onboarding */}
                <Route path="/plataforma/onboarding" element={<Onboarding />} />
                <Route path="/plataforma/onboarding/athos" element={<OnboardingAthos />} />
                {/* /plataforma/athos-gs faz parte do fluxo de onboarding (Athos) — não pode ficar atrás do OnboardingGuard */}
                <Route path="/plataforma/athos-gs" element={<AcessoGuard accessKey="acesso_os"><DescompliqueiOS /></AcessoGuard>} />
                {/* Rotas protegidas — redirecionam para /onboarding se não concluído */}
                <Route element={<OnboardingGuard />}>
                  <Route path="/plataforma" element={<Hub />} />
                  <Route path="/plataforma/jornada" element={<Jornada />} />
                  <Route path="/plataforma/jornada/estagio/:estagioId" element={<JornadaEstagio />} />
                  <Route path="/plataforma/sessoes-taticas" element={<AcessoGuard accessKey="acesso_sessoes_taticas"><SessoesTaticas /></AcessoGuard>} />
                  <Route path="/plataforma/materiais" element={<Navigate to="/crm/materiais" replace />} />
                  <Route path="/plataforma/configuracoes" element={<Navigate to="/crm/settings" replace />} />
                </Route>
              </Route>
            </Route>
            {/* Legados Plataforma */}
            <Route path="/onboarding" element={<Navigate to="/plataforma/onboarding" replace />} />
            <Route path="/sessoes-taticas" element={<Navigate to="/plataforma/sessoes-taticas" replace />} />
            <Route path="/materiais" element={<Navigate to="/crm/materiais" replace />} />
            <Route path="/configuracoes" element={<Navigate to="/crm/settings" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
              </Suspense>
              </AthosOSProvider>
              </TutorialProvider>
              </DashboardLeadsModalProvider>
            </PlataformaProvider>
          </BrandingProvider>
        </AuthProvider>
        </AuthHashErrorInterceptor>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
