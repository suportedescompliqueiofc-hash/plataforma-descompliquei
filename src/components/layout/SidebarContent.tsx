import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, Users, GitBranch, BarChart3, Settings, LogOut, ChevronLeft,
  MessageSquare, Bell, ShoppingCart, Bot, Zap, GitMerge, ShieldCheck,
  PlayCircle, Brain, Calendar, Target, CalendarDays, ImagePlay, PenLine
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useBranding } from "@/contexts/BrandingContext";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_ORG_ID, DESCOMPLIQUEI_ORG_ID } from "@/lib/constants";

interface SidebarContentProps {
  isCollapsed?: boolean;
  toggleCollapse?: () => void;
}

export function SidebarContent({ isCollapsed = false, toggleCollapse }: SidebarContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { profile, role } = useProfile();
  const { branding } = useBranding();
  const { plataformaUser, plan, progressPercent, cerebroPercent, acesso } = usePlataforma();

  const isSuperAdmin = role === 'superadmin';
  const isPlatformMode = location.pathname.startsWith('/plataforma');

  // Modais de segurança
  const [showExitOnboarding, setShowExitOnboarding] = useState(false);
  const [pendingUrl, setPendingUrl] = useState('');

  const isOnboardingActive = location.pathname.startsWith('/plataforma/onboarding') && plataformaUser?.onboarding_complete === false;

  const handleLinkClick = (e: any, url: string) => {
    if (isOnboardingActive) {
      e.preventDefault();
      setPendingUrl(url);
      setShowExitOnboarding(true);
    }
  };

  const forceExitOnboarding = () => {
    setShowExitOnboarding(false);
    navigate(pendingUrl);
  };

  const temPlataforma =
    isSuperAdmin || // superadmin sempre vê o botão Plataforma
    acesso.acesso_cerebro ||
    acesso.acesso_sessoes_taticas ||
    acesso.acesso_materiais ||
    acesso.acesso_ia_comercial ||
    (acesso.pilares_liberados?.length ?? 0) > 0 ||
    (acesso.ias_liberadas?.length ?? 0) > 0;

  const isDescompliqueiOrg = profile?.organization_id === DESCOMPLIQUEI_ORG_ID;

  const crmMenuItems = [
    { title: "Painel", icon: LayoutDashboard, path: "/crm" },
    { title: "Leads", icon: Users, path: "/crm/leads" },
    { title: "Pipeline", icon: GitBranch, path: "/crm/pipeline" },
    { title: "Agendamentos", icon: CalendarDays, path: "/crm/agendamentos" },
    { title: "Conversas", icon: MessageSquare, path: "/crm/conversas" },
    { title: "Notificações", icon: Bell, path: "/crm/notificacoes" },
    { title: "Vendas", icon: ShoppingCart, path: "/crm/vendas" },
    { title: "Metas", icon: Target, path: "/crm/metas" },
    ...(isDescompliqueiOrg ? [{ title: "Marketing", icon: BarChart3, path: "/crm/marketing-trafego" }] : []),
    ...(isDescompliqueiOrg ? [{ title: "Criativos", icon: ImagePlay, path: "/crm/criativos" }] : []),
    ...(isDescompliqueiOrg ? [{ title: "Canvas", icon: PenLine, path: "/crm/canvas" }] : []),
    { title: "Msgs Rápidas", icon: Zap, path: "/crm/quick-messages" },
    { title: "Cadências", icon: GitMerge, path: "/crm/cadences" },
    { title: "IA", icon: Bot, path: "/crm/ia" },
    { title: "Configurações", icon: Settings, path: "/crm/settings" },
    { title: "Super Admin CRM", icon: ShieldCheck, path: "/crm/super-admin-crm", superadminOnly: true },
    ...(temPlataforma ? [{ title: "Plataforma", icon: PlayCircle, path: "/plataforma" }] : []),
  ];

  const temTrilha = (acesso.pilares_liberados?.length ?? 0) > 0;
  const temIAs = acesso.acesso_ia_comercial || (acesso.ias_liberadas?.length ?? 0) > 0;

  const platformMenuItems = [
    { title: "Hub", icon: LayoutDashboard, path: "/plataforma" },
    ...(temTrilha ? [{ title: "Trilha C.L.A.R.O.", icon: PlayCircle, path: "/plataforma/trilha" }] : []),
    { title: "Cérebro Central", icon: Brain, path: "/plataforma/cerebro", accessKey: 'acesso_cerebro' as const },
    ...(temIAs ? [{ title: "IAs Comerciais", icon: Zap, path: "/plataforma/ia-comercial" }] : []),
    { title: "Meus Materiais", icon: Target, path: "/plataforma/materiais", accessKey: 'acesso_materiais' as const },
    { title: "Sessões Táticas", icon: Calendar, path: "/plataforma/sessoes-taticas", accessKey: 'acesso_sessoes_taticas' as const },
    { isSeparator: true, title: "Ferramenta" },
    { title: "Acessar CRM", icon: BarChart3, path: "/crm", accessKey: 'acesso_crm' as const },
    { isSeparator: true, title: "Admin", superadminOnly: true },
    { title: "Super Admin", icon: ShieldCheck, path: "/admin", superadminOnly: true }
  ];

  const menuItems = isPlatformMode
    ? platformMenuItems.filter(item => {
        if (item.superadminOnly && !isSuperAdmin) return false;
        if (item.accessKey && !acesso[item.accessKey]) return false;
        return true;
      })
    : crmMenuItems.filter(item => !item.superadminOnly || isSuperAdmin);

  const getInitials = (name?: string | null) => {
    if (!name) return user?.email?.charAt(0).toUpperCase() || 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleBackToMaster = async () => {
    if (!user) return;
    try {
      // Sempre restaurar para MASTER_ORG_ID (fonte de verdade), ignorando valor do localStorage
      const { error } = await supabase.from('perfis').update({ organization_id: MASTER_ORG_ID as any }).eq('id', user.id);
      if (error) throw error;
      localStorage.removeItem('original_master_org_id');
      window.location.href = '/crm';
    } catch (err: any) { console.error(err); }
  };

  const hasImpersonationFlag = !!localStorage.getItem('original_master_org_id');
  const isImpersonating = isSuperAdmin && hasImpersonationFlag;
  const isStuckOutsideMaster = isSuperAdmin && !hasImpersonationFlag && profile?.organization_id !== MASTER_ORG_ID;
  const showBackToAdmin = isImpersonating || isStuckOutsideMaster;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-sidebar">
        
        {/* LOGO */}
        <div className={`flex items-center transition-all h-20 flex-shrink-0 ${isCollapsed ? 'px-2 justify-center' : 'px-4'}`}>
          <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
            <Avatar className={`h-10 w-10 border-2 border-sidebar-primary/20 transition-all duration-300 flex-shrink-0 ${isCollapsed ? 'mx-auto' : ''}`}>
                {branding?.logo_url ? <AvatarImage src={branding.logo_url} className="object-contain p-0.5" /> : <AvatarImage src="" />}
                <AvatarFallback className="bg-sidebar-primary text-sidebar-background font-serif">{(branding?.brand_name || 'C').charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            
          <div className={`flex flex-col transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'flex-1 min-w-0 opacity-100 overflow-hidden'}`}>
              <h1 className="text-[11px] font-bold text-sidebar-foreground uppercase tracking-normal font-serif leading-none mb-0.5 truncate">{isPlatformMode ? 'Hub de Gestão Comercial' : branding?.brand_name || 'CRM'}</h1>
              <p className="text-[9px] text-sidebar-primary tracking-wide uppercase font-medium truncate">{isPlatformMode ? branding?.brand_name || 'Descompliquei' : branding?.tagline || 'Gestão Inteligente'}</p>
            </div>
          </div>
          {toggleCollapse && !isCollapsed && (
            <Button variant="ghost" size="icon" className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 ml-1 h-8 w-8 flex-shrink-0" onClick={toggleCollapse}><ChevronLeft className="h-4 w-4" /></Button>
          )}
        </div>
        
        {/* Toggle Closed -> Open */}
        {toggleCollapse && isCollapsed && (
          <div className="flex justify-center pb-2">
             <Button variant="ghost" size="icon" className="text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 h-8 w-8" onClick={toggleCollapse}><ChevronLeft className="h-4 w-4 rotate-180" /></Button>
          </div>
        )}

        <nav className={`flex-1 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-accent/20 scrollbar-track-transparent ${isCollapsed ? 'p-2' : 'p-3'}`}>
          {menuItems.map((item, index) => {
            if (item.isSeparator) {
              return !isCollapsed ? (
                <div key={`sep-${index}`} className="pt-4 pb-1 px-3">
                  <div className="border-t border-[#242424] mb-2" />
                  <p className="text-[10px] text-[#E85D24] font-bold tracking-widest uppercase">{item.title}</p>
                </div>
              ) : (
                <div key={`sep-${index}`} className="pt-4 pb-1 px-2 flex justify-center"><div className="border-t border-[#242424] w-full" /></div>
              );
            }
            const isActive = item.path && location.pathname.startsWith(item.path) && (item.path !== '/crm' || location.pathname === '/crm');
            const Icon = item.icon as any;
            
            const linkClasses = `flex items-center gap-3 py-2.5 rounded-lg transition-all ${isCollapsed ? 'justify-center px-2' : 'px-3'} ${isActive ? (isPlatformMode ? 'bg-[#E85D24] text-white font-medium shadow-sm' : 'bg-sidebar-accent text-sidebar-primary font-medium border-l-2 border-sidebar-primary') : 'text-sidebar-foreground/70 hover:bg-[#1A1A1A] hover:text-sidebar-foreground'}`;

            const isAcessarCRM = item.title === 'Acessar CRM';
            const linkProps: any = isAcessarCRM ? { target: "_blank", rel: "noopener noreferrer" } : {};

            return isCollapsed ? (
              <Tooltip key={`tooltip-${index}`} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link to={item.path || '#'} {...linkProps} className={linkClasses} onClick={(e) => handleLinkClick(e, item.path || '#')}>
                    <Icon className="h-5 w-5 flex-shrink-0" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.title}</TooltipContent>
              </Tooltip>
            ) : (
              <Link key={`link-${index}`} to={item.path || '#'} {...linkProps} className={linkClasses} onClick={(e) => handleLinkClick(e, item.path || '#')}>
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="truncate text-sm flex-1">{item.title}</span>
                {item.title === 'Trilha C.L.A.R.O.' && progressPercent > 0 && (
                  <Badge variant="outline" className={`ml-auto text-[9px] py-0 px-1 border-transparent ${progressPercent === 100 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-[#E85D24]/20 text-[#E85D24]'}`}>
                    {progressPercent}%
                  </Badge>
                )}
                {/* Badge do Cérebro */}
                {item.title === 'Cérebro Central' && cerebroPercent !== undefined && (
                  <Badge variant="outline" className={`ml-auto text-[9px] py-0 px-1 border-transparent ${cerebroPercent === 100 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-[#E85D24]/20 text-[#E85D24]'}`}>
                    {cerebroPercent}%
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className={`${isCollapsed ? 'p-2' : 'p-4'} border-t border-sidebar-border flex-shrink-0 space-y-2`}>
          {showBackToAdmin && (
             <Button variant="default" className={`w-full h-9 bg-[#E85D24] hover:bg-[#E85D24]/90 text-white shadow-lg ${isImpersonating ? 'animate-pulse' : ''} ${isCollapsed ? 'justify-center px-0' : 'justify-start px-3'}`} onClick={handleBackToMaster}><ShieldCheck className="h-4 w-4 flex-shrink-0" />{!isCollapsed && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider">{isImpersonating ? 'Sair do Cliente' : 'Voltar para Admin'}</span>}</Button>
          )}

          <div className={`flex items-center gap-3 mb-2 ${isCollapsed ? 'justify-center flex-col' : ''}`}>
            <Avatar className="h-9 w-9 flex-shrink-0 border border-sidebar-border">
              <AvatarImage src={profile?.url_avatar || ''} />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-primary font-serif text-xs">{getInitials(profile?.nome_completo)}</AvatarFallback>
            </Avatar>
            <div className={`flex-1 overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-full opacity-100'}`}>
              <div className="flex items-center gap-2">
			          <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.user_metadata?.full_name || profile?.nome_completo || plataformaUser?.clinic_name || 'Colaborador'}</p>
			          {plataformaUser && plan && !isSuperAdmin && (
                  <Badge variant="outline" className={`text-[9px] uppercase tracking-wider font-bold py-0 h-4 border-transparent ${plan === 'gca' ? 'bg-[#E85D24] text-white' : 'bg-muted text-muted-foreground'}`}>{plan}✅</Badge>
                )}
			        </div>
              <p className="text-[10px] text-sidebar-foreground/50 truncate w-full block">{user?.email}</p>
            </div>
          </div>
          {isPlatformMode && (
            <Button variant="ghost" className={`w-full h-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`} onClick={() => navigate('/plataforma/configuracoes')}>
              <Settings className="h-4 w-4 flex-shrink-0" />
              <span className={`ml-2 text-xs whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>Configurações</span>
            </Button>
          )}
          <Button variant="ghost" className={`w-full h-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`} onClick={signOut}><LogOut className="h-4 w-4 flex-shrink-0" /><span className={`ml-2 text-xs whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>Sair</span></Button>
        </div>

        {/* Modal de Onboarding bloqueando saída */}
        <Dialog open={showExitOnboarding} onOpenChange={setShowExitOnboarding}>
          <DialogContent className="sm:max-w-md border-border bg-card">
             <DialogHeader>
                <DialogTitle className="text-foreground">Configuração Incompleta ⚠️</DialogTitle>
                <DialogDescription>
                  Você ainda não finalizou a configuração inicial e calibração das IAs. Suas respostas ficarão limitadas se sair agora.
                </DialogDescription>
             </DialogHeader>
             <DialogFooter className="sm:justify-start flex gap-2">
               <Button type="button" variant="outline" className="border-border text-foreground hover:bg-muted font-bold flex-1" onClick={() => setShowExitOnboarding(false)}>
                 Continuar Configuração
               </Button>
               <Button type="button" variant="destructive" className="font-bold border-transparent flex-1" onClick={forceExitOnboarding}>
                 Ir assim mesmo
               </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}