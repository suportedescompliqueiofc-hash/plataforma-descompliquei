import { useState } from "react";
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
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PlataformaGuard } from "@/components/PlataformaGuard";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Pipeline from "./pages/Pipeline";
import Settings from "./pages/Settings";
import AiSettings from "./pages/AiSettings";
import NotFound from "./pages/NotFound";
import Conversations from "./pages/Conversas";
import Notifications from "./pages/Notifications";
import Vendas from "./pages/Vendas";
import { Navigate } from "react-router-dom";
import QuickMessagesPage from "./pages/QuickMessagesPage";
import Cadences from "./pages/Cadences";
import SuperAdmin from "./pages/SuperAdmin";
import AdminGuard from "./pages/admin-os/AdminGuard";
import AdminLayout from "./pages/admin-os/AdminLayout";
import AdminDashboard from "./pages/admin-os/pages/AdminDashboard";
import AdminClientes from "./pages/admin-os/pages/AdminClientes";
import AdminClientePerfil from "./pages/admin-os/pages/AdminClientePerfil";
import AdminTrilha from "./pages/admin-os/pages/AdminTrilha";
import AdminIAs from "./pages/admin-os/pages/AdminIAs";
import AdminSessoes from "./pages/admin-os/pages/AdminSessoes";
import AdminMateriais from "./pages/admin-os/pages/AdminMateriais";
import AdminCalendario from "./pages/admin-os/pages/AdminCalendario";
import AdminTarefas from "./pages/admin-os/pages/AdminTarefas";
import AdminRelatorios from "./pages/admin-os/pages/AdminRelatorios";
import AdminSistema from "./pages/admin-os/pages/AdminSistema";
import AdminGestaoAcessos from "./pages/admin-os/pages/AdminGestaoAcessos";
import AdminProdutos from "./pages/admin-os/pages/AdminProdutos";
import AdminAcessoCliente from "./pages/admin-os/pages/AdminAcessoCliente";
import { AcessoGuard } from "./components/AcessoGuard";
import { CrmGuard } from "./components/CrmGuard";
import { getRedirectDestino } from "./utils/redirectUtils";
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
import Modulo from "./pages/plataforma/Modulo";
import Pilar from "./pages/plataforma/Pilar";
import Cerebro from "./pages/plataforma/Cerebro";
import IAHub from "./pages/plataforma/IAHub";
import IATipo from "./pages/plataforma/IATipo";
import SessoesTaticas from "./pages/plataforma/SessoesTaticas";
import Onboarding from "./pages/plataforma/Onboarding";
import Materiais from "./pages/plataforma/Materiais";
import Configuracoes from "./pages/plataforma/Configuracoes";
import PlataformaLogin from "./pages/plataforma/PlataformaLogin";
import { PlataformaProvider } from "@/contexts/PlataformaContext";

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
  const { acesso, isContextLoading } = usePlataforma();
  const { role, isLoading: isLoadingProfile } = useProfile();
  if (authLoading || (user && (isContextLoading || isLoadingProfile))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'superadmin') return <Navigate to="/admin" replace />;
  return <Navigate to={getRedirectDestino(acesso)} replace />;
}

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage('sidebar-collapsed', false);
  const location = useLocation();
  const isConversationsPage = location.pathname.startsWith('/crm/conversas');
  const isPlataformaRoute = location.pathname.startsWith('/plataforma');

  // Usar hook para verificar se é superadmin
  const { role, profile } = useProfile();
  const { diasRestantes } = usePlataforma();
  const [isReturning, setIsReturning] = useState(false);
  const isSuperAdmin = role === 'superadmin';
  
  // Impersonação: superadmin cuja org atual é diferente da master (não depende de localStorage)
  const isImpersonating = isSuperAdmin && !!profile?.organization_id && profile.organization_id !== MASTER_ORG_ID;
  const showBanner = isImpersonating;

  const handleReturnToMaster = async () => {
    try {
      setIsReturning(true);

      // Usa localStorage se disponível, senão usa a constante MASTER_ORG_ID diretamente
      const originalOrgId = localStorage.getItem('original_master_org_id') || MASTER_ORG_ID;

      if (!profile?.id) {
        throw new Error('Perfil não encontrado. Recarregue a página.');
      }

      const { error } = await supabase
        .from('perfis')
        .update({ organization_id: originalOrgId as any })
        .eq('id', profile.id);

      if (error) throw error;

      localStorage.removeItem('original_master_org_id');

      toast.success('Sessão restaurada. Retornando ao painel master...');
      setTimeout(() => {
        window.location.href = '/crm/super-admin-crm';
      }, 1000);

    } catch (err: any) {
      toast.error('Erro ao retornar: ' + err.message);
      setIsReturning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden flex flex-col">
      {showBanner && (
        <div className="bg-primary/95 text-primary-foreground text-xs sm:text-sm font-medium py-1.5 px-4 text-center shadow-md z-[60] relative flex items-center justify-center gap-4">
          <span>🛡️ <strong>Acesso Master Ativo</strong> — Atuando na conta do cliente neste CRM.</span>
          <Button
            variant="secondary"
            size="sm"
            className="h-6 text-[10px] px-2 py-0 font-bold uppercase tracking-wider"
            onClick={handleReturnToMaster}
            disabled={isReturning}
          >
            {isReturning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : 'Voltar para Master'}
          </Button>
        </div>
      )}
      {isPlataformaRoute && diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 7 && (
        <div className="bg-orange-500 text-white text-xs sm:text-sm font-medium py-1.5 px-4 text-center shadow-md z-[60] relative">
          ⚠️ <strong>Seu acesso expira em {diasRestantes === 0 ? 'hoje' : `${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}`}.</strong> Entre em contato para renovar.
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
        <AuthProvider>
          <BrandingProvider>
            <PlataformaProvider>
              <Routes>
            {/* CRM — AppLayout persiste, CrmGuard só controla o conteúdo */}
            <Route path="/crm/login" element={<Navigate to="/login" replace />} />
            <Route path="/" element={<RootRedirect />} />
            <Route element={<AppLayoutRoute />}>
              <Route element={<CrmGuard />}>
                <Route path="/crm" element={<Dashboard />} />
                <Route path="/crm/leads" element={<Leads />} />
                <Route path="/crm/pipeline" element={<Pipeline />} />
                <Route path="/crm/quick-messages" element={<QuickMessagesPage />} />
                <Route path="/crm/cadences" element={<Cadences />} />
                <Route path="/crm/ia" element={<AiSettings />} />
                <Route path="/crm/settings" element={<Settings />} />
                <Route path="/crm/conversas" element={<Conversations />} />
                <Route path="/crm/conversas/:leadId" element={<Conversations />} />
                <Route path="/crm/notificacoes" element={<Notifications />} />
                <Route path="/crm/vendas" element={<Vendas />} />
                <Route path="/crm/super-admin-crm" element={<SuperAdmin />} />
              </Route>
            </Route>
            {/* Legados CRM */}
            <Route path="/login" element={<PlataformaLogin />} />
            <Route path="/leads" element={<Navigate to="/crm/leads" replace />} />
            <Route path="/pipeline" element={<Navigate to="/crm/pipeline" replace />} />
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
                <Route path="/admin/clientes" element={<AdminClientes />} />
                <Route path="/admin/clientes/:id" element={<AdminClientePerfil />} />
                <Route path="/admin/trilha" element={<AdminTrilha />} />
                <Route path="/admin/trilha/pilar/:pillarId" element={<AdminTrilha />} />
                <Route path="/admin/trilha/modulo/:moduleId" element={<AdminTrilha />} />
                <Route path="/admin/ias" element={<AdminIAs />} />
                <Route path="/admin/sessoes" element={<AdminSessoes />} />
                <Route path="/admin/materiais" element={<AdminMateriais />} />
                <Route path="/admin/calendario" element={<AdminCalendario />} />
                <Route path="/admin/tarefas" element={<AdminTarefas />} />
                <Route path="/admin/relatorios" element={<AdminRelatorios />} />
                <Route path="/admin/sistema" element={<AdminSistema />} />
                <Route path="/admin/acessos" element={<AdminGestaoAcessos />} />
                <Route path="/admin/acessos/:orgId" element={<AdminAcessoCliente />} />
                <Route path="/admin/produtos" element={<AdminProdutos />} />
              </Route>
            </Route>
            {/* Plataforma — AppLayout persiste, PlataformaGuard só controla o conteúdo */}
            <Route path="/plataforma/login" element={<Navigate to="/login" replace />} />
            <Route element={<AppLayoutRoute />}>
              <Route element={<PlataformaGuard />}>
                <Route path="/plataforma" element={<Hub />} />
                <Route path="/plataforma/onboarding" element={<Onboarding />} />
                <Route path="/plataforma/trilha" element={<AcessoGuard arrayKey="pilares_liberados"><Trilha /></AcessoGuard>} />
                <Route path="/plataforma/trilha/pilar/:pilarId" element={<AcessoGuard arrayKey="pilares_liberados"><Pilar /></AcessoGuard>} />
                <Route path="/plataforma/trilha/:moduloId" element={<AcessoGuard arrayKey="pilares_liberados"><Modulo /></AcessoGuard>} />
                <Route path="/plataforma/cerebro" element={<AcessoGuard accessKey="acesso_cerebro"><Cerebro /></AcessoGuard>} />
                <Route path="/plataforma/ia-comercial" element={<AcessoGuard accessKey="acesso_ia_comercial"><IAHub /></AcessoGuard>} />
                <Route path="/plataforma/ia-comercial/:tipo" element={<AcessoGuard accessKey="acesso_ia_comercial"><IATipo /></AcessoGuard>} />
                <Route path="/plataforma/sessoes-taticas" element={<AcessoGuard accessKey="acesso_sessoes_taticas"><SessoesTaticas /></AcessoGuard>} />
                <Route path="/plataforma/materiais" element={<AcessoGuard accessKey="acesso_materiais"><Materiais /></AcessoGuard>} />
                <Route path="/plataforma/configuracoes" element={<Configuracoes />} />
              </Route>
            </Route>
            {/* Legados Plataforma */}
            <Route path="/onboarding" element={<Navigate to="/plataforma/onboarding" replace />} />
            <Route path="/trilha" element={<Navigate to="/plataforma/trilha" replace />} />
            <Route path="/trilha/pilar/:pilarId" element={<RedirectParam to="/plataforma/trilha/pilar/:pilarId" />} />
            <Route path="/trilha/:moduloId" element={<RedirectParam to="/plataforma/trilha/:moduloId" />} />
            <Route path="/cerebro" element={<Navigate to="/plataforma/cerebro" replace />} />
            <Route path="/ia-comercial" element={<Navigate to="/plataforma/ia-comercial" replace />} />
            <Route path="/ia-comercial/:tipo" element={<RedirectParam to="/plataforma/ia-comercial/:tipo" />} />
            <Route path="/sessoes-taticas" element={<Navigate to="/plataforma/sessoes-taticas" replace />} />
            <Route path="/materiais" element={<Navigate to="/plataforma/materiais" replace />} />
            <Route path="/configuracoes" element={<Navigate to="/plataforma/configuracoes" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
            </PlataformaProvider>
          </BrandingProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
