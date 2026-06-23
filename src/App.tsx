import { useState, useEffect } from "react";
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
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlataformaGuard } from "@/components/PlataformaGuard";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Settings from "./pages/Settings";
import AiSettings from "./pages/AiSettings";
import NotFound from "./pages/NotFound";
import Conversations from "./pages/Conversas";
import Notifications from "./pages/Notifications";
import Vendas from "./pages/Vendas";
import { Navigate } from "react-router-dom";
import QuickMessagesPage from "./pages/QuickMessagesPage";
import Cadences from "./pages/Cadences";
import MarketingTrafego from "./pages/MarketingTrafego";
import Agendamentos from "./pages/Agendamentos";
import Metas from "./pages/Metas";
import Equipe from "./pages/Equipe";
import Performance from "./pages/Performance";
import Procedimentos from "./pages/Procedimentos";
import JornadaPaciente from "./pages/JornadaPaciente";
import CriativosBiblioteca from "./pages/CriativosBiblioteca";
import CriativosPasta from "./pages/CriativosPasta";
import Canvas from "./pages/Canvas";
import SuperAdmin from "./pages/SuperAdmin";
import { TutorialProvider } from "./components/tutorial/TutorialProvider";
import { TutorialSpotlight } from "./components/tutorial/TutorialSpotlight";
import { TutorialHelpCenter } from "./components/tutorial/TutorialHelpCenter";
import { OnboardingModal } from "./components/onboarding/OnboardingModal";
import { MemberWelcomeModal } from "./components/onboarding/MemberWelcomeModal";
import { OnboardingPlataformaChecklist } from "./components/plataforma/OnboardingPlataformaChecklist";
import OnboardingPlataformaModal from "./components/plataforma/OnboardingPlataformaModal";
import CrmOnboarding from "./pages/CrmOnboarding";

// Outbound pages
import OutboundPainel from "./pages/outbound/OutboundPainel";
import OutboundProspectos from "./pages/outbound/OutboundProspectos";
import OutboundPipeline from "./pages/outbound/OutboundPipeline";
import OutboundLigacoes from "./pages/outbound/OutboundLigacoes";
import OutboundAgendamentos from "./pages/outbound/OutboundAgendamentos";
import OutboundConversas from "./pages/outbound/OutboundConversas";
import OutboundVendas from "./pages/outbound/OutboundVendas";
import OutboundScripts from "./pages/outbound/OutboundScripts";
import OutboundCadencias from "./pages/outbound/OutboundCadencias";
import OutboundMetas from "./pages/outbound/OutboundMetas";
import OutboundConfiguracoes from "./pages/outbound/OutboundConfiguracoes";
import { OutboundLayout } from "./components/outbound/OutboundLayout";
import AdminGuard from "./pages/admin-os/AdminGuard";
import AdminLayout from "./pages/admin-os/AdminLayout";
import AdminDashboard from "./pages/admin-os/pages/AdminDashboard";
import AdminClientes from "./pages/admin-os/pages/AdminClientes";
import AdminClientePerfil from "./pages/admin-os/pages/AdminClientePerfil";
import AdminTrilha from "./pages/admin-os/pages/AdminTrilha";
import AdminTrilhaWrapper from "./pages/admin-os/AdminTrilhaWrapper";
import AdminArsenal from "./pages/admin-os/pages/AdminArsenal";
import AdminJornadas from "./pages/admin-os/pages/AdminJornadas";
import AdminJornadaEditor from "./pages/admin-os/pages/AdminJornadaEditor";
import AdminIAs from "./pages/admin-os/pages/AdminIAs";
import AdminSessoes from "./pages/admin-os/pages/AdminSessoes";
import AdminSistema from "./pages/admin-os/pages/AdminSistema";
import AdminSuporte from "./pages/admin-os/pages/AdminSuporte";
import AdminProdutos from "./pages/admin-os/pages/AdminProdutos";
import AdminAthos from "./pages/admin-os/pages/AdminAthos";
import AdminAcessoCliente from "./pages/admin-os/pages/AdminAcessoCliente";
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
import Hub from "./pages/plataforma/Hub";
import Trilha from "./pages/plataforma/Trilha";
import Arsenal from "./pages/plataforma/Arsenal";
import Jornada from "./pages/plataforma/Jornada";
import ArsenalCategoria from "./pages/plataforma/ArsenalCategoria";
import ArsenalFerramenta from "./pages/plataforma/ArsenalFerramenta";
import ArsenalAula from "./pages/plataforma/ArsenalAula";
import DescompliqueiOS from "./pages/plataforma/DescompliqueiOS";
import Modulo from "./pages/plataforma/Modulo";
import Pilar from "./pages/plataforma/Pilar";
import IAHub from "./pages/plataforma/IAHub";
import IATipo from "./pages/plataforma/IATipo";
import SessoesTaticas from "./pages/plataforma/SessoesTaticas";
import Onboarding from "./pages/plataforma/Onboarding";
import OnboardingAthos from "./pages/plataforma/OnboardingAthos";
import Materiais from "./pages/plataforma/Materiais";
import MateriaisEditor from "./pages/plataforma/MateriaisEditor";
import Configuracoes from "./pages/plataforma/Configuracoes";
import Evolucao from "./pages/plataforma/Evolucao";
import PlataformaLogin from "./pages/plataforma/PlataformaLogin";
import { PlataformaProvider } from "@/contexts/PlataformaContext";

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

    // Mapeia códigos de erro para mensagens amigáveis
    let msgKey = 'link-invalido';
    if (errorCode === 'otp_expired') msgKey = 'link-expirado';
    else if (errorCode === 'access_denied') msgKey = 'acesso-negado';

    // Redireciona para login com a mensagem
    window.location.href = `/login?msg=${msgKey}`;
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

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage('sidebar-collapsed', false);
  const { modal, closeModal } = useDashboardLeadsModal();
  const location = useLocation();
  const isConversationsPage = location.pathname.startsWith('/crm/conversas') || location.pathname.startsWith('/outbound/conversas') || location.pathname.startsWith('/plataforma/athos-gs');
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
      {isPlataformaRoute && diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 7 && (
        <div className="bg-[#E85D24] text-white text-xs sm:text-sm font-medium py-2 px-4 text-center z-[60] relative">
          <strong>Seu acesso expira em {diasRestantes === 0 ? 'hoje' : `${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}`}.</strong> Entre em contato para renovar.
        </div>
      )}
      {waDisconnected && (
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
      <div className="hidden lg:block relative">
        <Sidebar 
          isCollapsed={isSidebarCollapsed} 
          toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        />
      </div>
      
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-[280px] bg-sidebar border-r-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      <Header 
        onMenuClick={() => setMobileMenuOpen(true)} 
        isSidebarCollapsed={isSidebarCollapsed}
      />
      <main className={cn(
        "pt-16 transition-all duration-300 flex-1 flex flex-col",
        isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      )}>
        <div className={cn(
          "w-full max-w-full overflow-x-hidden flex-1",
          !isConversationsPage && "p-4 sm:p-6"
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
        />
      )}
    </div>
  );
};

/** Layout route version of AppLayout — persists sidebar across route changes */
const AppLayoutRoute = () => <AppLayout><Outlet /></AppLayout>;

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
              <OnboardingPlataformaModal />
              <OnboardingPlataformaChecklist />
              <Routes>
            {/* CRM — AppLayout persiste, CrmGuard só controla o conteúdo */}
            <Route path="/crm/login" element={<Navigate to="/login" replace />} />
            <Route path="/" element={<RootRedirect />} />
            <Route element={<AppLayoutRoute />}>
              <Route element={<CrmGuard />}>
                <Route path="/crm" element={<Dashboard />} />
                <Route path="/crm/leads" element={<Leads />} />
                <Route path="/crm/agendamentos" element={<Agendamentos />} />
                <Route path="/crm/quick-messages" element={<QuickMessagesPage />} />
                <Route path="/crm/cadences" element={<Cadences />} />
                <Route path="/crm/ia" element={<AiSettings />} />
                <Route path="/crm/settings" element={<Settings />} />
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
            <Route path="/quick-messages" element={<Navigate to="/crm/quick-messages" replace />} />
            <Route path="/cadences" element={<Navigate to="/crm/cadences" replace />} />
            <Route path="/ia" element={<Navigate to="/crm/ia" replace />} />
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
                <Route path="/admin/trilha" element={<AdminTrilhaWrapper />} />
                <Route path="/admin/trilha/pilar/:pillarId" element={<AdminTrilhaWrapper />} />
                <Route path="/admin/trilha/modulo/:moduleId" element={<AdminTrilhaWrapper />} />
                <Route path="/admin/arsenal" element={<AdminArsenal />} />
                <Route path="/admin/jornadas" element={<AdminJornadas />} />
                <Route path="/admin/jornadas/:id" element={<AdminJornadaEditor />} />
                <Route path="/admin/ias" element={<AdminIAs />} />
                <Route path="/admin/sessoes" element={<AdminSessoes />} />
                <Route path="/admin/sistema" element={<AdminSistema />} />
                <Route path="/admin/suporte" element={<AdminSuporte />} />
                <Route path="/admin/acessos/:orgId" element={<AdminAcessoCliente />} />
                <Route path="/admin/produtos" element={<AdminProdutos />} />
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
                  <Route path="/plataforma/trilha" element={<AcessoGuard arrayKey="pilares_liberados"><Trilha /></AcessoGuard>} />
                  <Route path="/plataforma/trilha/pilar/:pilarId" element={<AcessoGuard arrayKey="pilares_liberados"><Pilar /></AcessoGuard>} />
                  <Route path="/plataforma/trilha/:moduloId" element={<AcessoGuard arrayKey="pilares_liberados"><Modulo /></AcessoGuard>} />
                  <Route path="/plataforma/jornada" element={<Jornada />} />
                  <Route path="/plataforma/arsenal" element={<Arsenal />} />
                  <Route path="/plataforma/arsenal/aulas/:aulaSlug" element={<ArsenalAula />} />
                  <Route path="/plataforma/arsenal/:slug" element={<ArsenalCategoria />} />
                  <Route path="/plataforma/arsenal/:slug/:ferrSlug" element={<ArsenalFerramenta />} />
                  <Route path="/plataforma/sessoes-taticas" element={<AcessoGuard accessKey="acesso_sessoes_taticas"><SessoesTaticas /></AcessoGuard>} />
                  <Route path="/plataforma/materiais" element={<AcessoGuard accessKey="acesso_materiais"><Materiais /></AcessoGuard>} />
                  <Route path="/plataforma/materiais/:id" element={<AcessoGuard accessKey="acesso_materiais"><MateriaisEditor /></AcessoGuard>} />
                  <Route path="/plataforma/configuracoes" element={<Configuracoes />} />
                </Route>
              </Route>
            </Route>
            {/* Legados Plataforma */}
            <Route path="/onboarding" element={<Navigate to="/plataforma/onboarding" replace />} />
            <Route path="/trilha" element={<Navigate to="/plataforma/trilha" replace />} />
            <Route path="/trilha/pilar/:pilarId" element={<RedirectParam to="/plataforma/trilha/pilar/:pilarId" />} />
            <Route path="/trilha/:moduloId" element={<RedirectParam to="/plataforma/trilha/:moduloId" />} />
            <Route path="/sessoes-taticas" element={<Navigate to="/plataforma/sessoes-taticas" replace />} />
            <Route path="/materiais" element={<Navigate to="/plataforma/materiais" replace />} />
            <Route path="/configuracoes" element={<Navigate to="/plataforma/configuracoes" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
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
