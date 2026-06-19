import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, BarChart3, Settings, LogOut, ChevronLeft,
  MessageSquare, Bell, ShoppingCart, Bot, Zap, GitMerge, GitBranch, ShieldCheck,
  PlayCircle, Brain, Calendar, Target, CalendarDays, ImagePlay, PenLine,
  Phone, FileText, Stethoscope, Trophy, Rocket, TrendingUp, Sparkles, Swords, Route
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
import { TutorialHelpButton } from "@/components/tutorial/TutorialHelpButton";
import { usePerformanceBadge } from "@/hooks/usePerformance";
import { usePermissions, PageKey } from "@/hooks/usePermissions";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useWhatsAppMonitor } from "@/hooks/useWhatsAppMonitor";

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
  const { plataformaUser, plan, progressPercent, acesso, isContextLoading: plataformaLoading, isMember } = usePlataforma();
  const { pending: performancePending } = usePerformanceBadge();
  const { showInSidebar: showOnboarding, completedCount: onboardingDone, totalCount: onboardingTotal } = useOnboarding();
  useWhatsAppMonitor();

  const isSuperAdmin = role === 'superadmin';
  const permissions = usePermissions();
  const isPlatformMode = location.pathname.startsWith('/plataforma');
  const isOutboundMode = location.pathname.startsWith('/outbound');

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
    acesso.acesso_sessoes_taticas ||
    acesso.acesso_materiais ||
    acesso.acesso_ia_comercial ||
    (acesso.pilares_liberados?.length ?? 0) > 0 ||
    (acesso.ias_liberadas?.length ?? 0) > 0;

  const isDescompliqueiOrg = profile?.organization_id === DESCOMPLIQUEI_ORG_ID;

  const crmMenuItems = [
    ...(showOnboarding ? [{ title: "Configuração Inicial", icon: Rocket, path: "/crm/onboarding" }] : []),
    { isSeparator: true, title: "Visão Geral" },
    { title: "Painel", icon: LayoutDashboard, path: "/crm" },
    { title: "Performance", icon: Trophy, path: "/crm/performance" },
    { title: "Conversas", icon: MessageSquare, path: "/crm/conversas" },
    { title: "Notificações", icon: Bell, path: "/crm/notificacoes" },
    { isSeparator: true, title: "Comercial" },
    { title: "Leads", icon: Users, path: "/crm/leads" },
    { title: "Agendamentos", icon: CalendarDays, path: "/crm/agendamentos" },
    { title: "Vendas", icon: ShoppingCart, path: "/crm/vendas" },
    { title: "Procedimentos", icon: Stethoscope, path: "/crm/procedimentos" },
    { title: "Metas", icon: Target, path: "/crm/metas" },
    { title: "Evolução", icon: TrendingUp, path: "/crm/evolucao" },
    { isSeparator: true, title: "Automação" },
    { title: "Msgs Rápidas", icon: Zap, path: "/crm/quick-messages" },
    { title: "Cadências", icon: GitMerge, path: "/crm/cadences" },
    { title: "IA", icon: Bot, path: "/crm/ia" },
    ...(isDescompliqueiOrg ? [
      { isSeparator: true, title: "Marketing" },
      { title: "Tráfego", icon: BarChart3, path: "/crm/marketing-trafego" },
      { title: "Criativos", icon: ImagePlay, path: "/crm/criativos" },
      { title: "Canvas", icon: PenLine, path: "/crm/canvas" },
    ] : []),
    ...(isDescompliqueiOrg ? [
      { isSeparator: true, title: "Prospecção" },
      { title: "Outbound", icon: Phone, path: "/outbound/painel" },
    ] : []),
    { isSeparator: true, title: "Sistema" },
    { title: "Configurações", icon: Settings, path: "/crm/settings" },
    { title: "Super Admin CRM", icon: ShieldCheck, path: "/crm/super-admin-crm", superadminOnly: true },
    ...(temPlataforma ? [{ title: "Plataforma", icon: PlayCircle, path: "/plataforma" }] : []),
  ];

  const outboundMenuItems = [
    { title: "Painel", icon: LayoutDashboard, path: "/outbound/painel" },
    { title: "Prospectos", icon: Users, path: "/outbound/prospectos" },
    { title: "Pipeline", icon: GitBranch, path: "/outbound/pipeline" },
    { title: "Ligações", icon: Phone, path: "/outbound/ligacoes" },
    { title: "Agendamentos", icon: CalendarDays, path: "/outbound/agendamentos" },
    { title: "Conversas", icon: MessageSquare, path: "/outbound/conversas" },
    { title: "Vendas", icon: ShoppingCart, path: "/outbound/vendas" },
    { title: "Scripts", icon: FileText, path: "/outbound/scripts" },
    { title: "Cadências", icon: GitMerge, path: "/outbound/cadencias" },
    { title: "Metas", icon: Target, path: "/outbound/metas" },
    { title: "Configurações", icon: Settings, path: "/outbound/configuracoes" },
    { isSeparator: true, title: "Voltar" },
    { title: "Voltar ao CRM", icon: BarChart3, path: "/crm" },
  ];

  // Durante o loading, manter os itens visíveis (evitar flicker na navegação)
  const temTrilha = plataformaLoading || (acesso.pilares_liberados?.length ?? 0) > 0;
  const temIAs = plataformaLoading || acesso.acesso_ia_comercial || (acesso.ias_liberadas?.length ?? 0) > 0;
  const temOS = plataformaLoading || acesso.acesso_os;

  const platformMenuItems = [
    { title: "Hub", icon: LayoutDashboard, path: "/plataforma" },
    { isSeparator: true, title: "Aprendizado" },
    { title: "Jornada", icon: Route, path: "/plataforma/jornada" },
    { title: "Arsenal", icon: Swords, path: "/plataforma/arsenal" },
    { title: "Meus Materiais", icon: Target, path: "/plataforma/materiais", accessKey: 'acesso_materiais' as const },
    { isSeparator: true, title: "Ao Vivo" },
    { title: "Sessões Táticas", icon: Calendar, path: "/plataforma/sessoes-taticas", accessKey: 'acesso_sessoes_taticas' as const },
    { isSeparator: true, title: "Ferramenta" },
    ...(temOS ? [{ title: "Athos GS", icon: Sparkles, path: "/plataforma/athos-gs" }] : []),
    { title: "Acessar CRM", icon: BarChart3, path: "/crm", accessKey: 'acesso_crm' as const },
    { isSeparator: true, title: "Admin", superadminOnly: true },
    { title: "Super Admin", icon: ShieldCheck, path: "/admin", superadminOnly: true }
  ];

  // Mapeamento path CRM → chave de permissão
  const PATH_PERMISSION_MAP: Record<string, PageKey> = {
    '/crm':                    'painel',
    '/crm/conversas':          'conversas',
    '/crm/notificacoes':       'notificacoes',
    '/crm/leads':              'leads',
    '/crm/agendamentos':       'agendamentos',
    '/crm/vendas':             'vendas',
    '/crm/procedimentos':      'procedimentos',
    '/crm/metas':              'metas',
    '/crm/quick-messages':     'msgs_rapidas',
    '/crm/cadences':           'cadencias',
    '/crm/ia':                 'ia',
    '/crm/settings':           'configuracoes',
    '/plataforma':             'plataforma',
  };

  // Chaves que partem como `true` em ACESSO_TOTAL mas devem ser `false` para membros.
  // Escondê-las durante o loading evita o flash antes da detecção de membro terminar.
  const MEMBER_RESTRICTED_KEYS = new Set(['acesso_materiais']);

  const menuItems = isPlatformMode
    ? platformMenuItems.filter(item => {
        if (item.superadminOnly && !isSuperAdmin) return false;
        // Durante loading, não filtrar por acesso — evita flicker na navegação
        if (plataformaLoading) return true;
        if (item.accessKey && !acesso[item.accessKey]) return false;
        return true;
      })
    : isOutboundMode
    ? outboundMenuItems
    : crmMenuItems.filter(item => {
        if (item.superadminOnly && !isSuperAdmin) return false;
        // Se for dono ou permissões ainda não carregadas, mostrar tudo
        if (permissions.isOwner) return true;
        // Separadores sempre visíveis
        if (item.isSeparator) return true;
        // Itens sem path (ex: separadores com title) — mostrar
        if (!item.path) return true;
        // Configurações sempre visível para todos os membros —
        // contém perfil pessoal e senha que são independentes das permissões da org
        if (item.path === '/crm/settings') return true;
        const permKey = PATH_PERMISSION_MAP[item.path];
        // Se não tem mapeamento (ex: marketing, criativos), mostrar apenas para donos
        if (!permKey) return permissions.isOwner;
        return permissions.canAccess(permKey);
      });

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

  // Map menu paths to data-tutorial attributes for the tutorial system
  const tutorialTargetMap: Record<string, string> = {
    '/crm': 'sidebar-painel',
    '/crm/conversas': 'sidebar-conversas',
    '/crm/notificacoes': 'sidebar-notificacoes',
    '/crm/leads': 'sidebar-leads',
    '/crm/agendamentos': 'sidebar-agendamentos',
    '/crm/vendas': 'sidebar-vendas',
    '/crm/procedimentos': 'sidebar-procedimentos',
    '/crm/metas': 'sidebar-metas',
    '/crm/quick-messages': 'sidebar-quick-messages',
    '/crm/cadences': 'sidebar-cadences',
    '/crm/ia': 'sidebar-ia',
    '/crm/settings': 'sidebar-settings',
    // Plataforma
    '/plataforma': 'sidebar-hub',
    '/plataforma/arsenal': 'sidebar-arsenal',
    '/plataforma/trilha': 'sidebar-trilha',
    '/plataforma/materiais': 'sidebar-materiais',
    '/plataforma/sessoes-taticas': 'sidebar-sessoes',
    '/plataforma/athos-gs': 'sidebar-os',
    '/plataforma/jornada': 'sidebar-jornada',
    '/crm/evolucao': 'sidebar-evolucao',
  };

  const hasImpersonationFlag = !!localStorage.getItem('original_master_org_id');
  const isImpersonating = isSuperAdmin && hasImpersonationFlag;
  const isStuckOutsideMaster = isSuperAdmin && !hasImpersonationFlag && profile?.organization_id !== MASTER_ORG_ID;
  const showBackToAdmin = isImpersonating || isStuckOutsideMaster;

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-sidebar">
        
        {/* LOGO */}
        <div className={`flex items-center transition-all h-16 flex-shrink-0 border-b border-white/[0.06] ${isCollapsed ? 'px-2 justify-center' : 'px-5'}`}>
          <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
            <Avatar className={`h-9 w-9 rounded-lg border border-white/[0.08] transition-all duration-300 flex-shrink-0 ${isCollapsed ? 'mx-auto' : ''}`}>
                {branding?.logo_url ? <AvatarImage src={branding.logo_url} className="object-contain p-0.5" /> : <AvatarImage src="" />}
                <AvatarFallback className="bg-white/[0.08] text-sidebar-foreground font-medium rounded-lg text-sm">{(branding?.brand_name || 'C').charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>

          <div className={`flex flex-col transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'flex-1 min-w-0 opacity-100 overflow-hidden'}`}>
              <h1 className="text-[13px] font-semibold text-sidebar-foreground leading-tight truncate">{isPlatformMode ? 'Hub de Gestão' : isOutboundMode ? 'Prospecção Ativa' : branding?.brand_name || 'CRM'}</h1>
              <p className="text-[10px] text-white/40 tracking-wide truncate">{isPlatformMode ? branding?.brand_name || 'Descompliquei' : isOutboundMode ? 'Outbound' : branding?.tagline || 'Gestão Inteligente'}</p>
            </div>
          </div>
          {toggleCollapse && !isCollapsed && (
            <Button variant="ghost" size="icon" className="text-white/30 hover:text-white/60 hover:bg-white/[0.06] ml-1 h-7 w-7 flex-shrink-0" onClick={toggleCollapse}><ChevronLeft className="h-3.5 w-3.5" /></Button>
          )}
        </div>
        
        {/* Toggle Closed -> Open */}
        {toggleCollapse && isCollapsed && (
          <div className="flex justify-center pb-1">
             <Button variant="ghost" size="icon" className="text-white/30 hover:text-white/60 hover:bg-white/[0.06] h-7 w-7" onClick={toggleCollapse}><ChevronLeft className="h-3.5 w-3.5 rotate-180" /></Button>
          </div>
        )}

        <nav data-tutorial="sidebar" className={`flex-1 space-y-0.5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/[0.08] scrollbar-track-transparent ${isCollapsed ? 'p-2' : 'px-3 py-4'}`}>
          {menuItems.map((item, index) => {
            if (item.isSeparator) {
              const isFirst = index === 0;
              return !isCollapsed ? (
                <div key={`sep-${index}`} className={`${isFirst ? 'pt-0' : 'pt-5'} pb-2 px-3`}>
                  <p className="text-[10px] text-white/25 font-semibold tracking-[0.12em] uppercase">{item.title}</p>
                </div>
              ) : (
                isFirst ? null : <div key={`sep-${index}`} className="pt-4 pb-1 px-2 flex justify-center"><div className="border-t border-white/[0.06] w-full" /></div>
              );
            }
            const isActive = item.path && (
              item.path === '/plataforma'
                ? location.pathname === '/plataforma' || location.pathname === '/plataforma/'
                : item.path === '/crm'
                  ? location.pathname === '/crm'
                  : location.pathname.startsWith(item.path)
            );
            const Icon = item.icon as any;

            const linkClasses = `flex items-center gap-3 py-2 rounded-md transition-all duration-150 relative ${isCollapsed ? 'justify-center px-2' : 'px-3'} ${isActive ? 'bg-[#E85D24]/[0.12] text-white font-medium' : 'text-white/50 hover:bg-white/[0.05] hover:text-white/80'}`;

            const isAcessarCRM = item.title === 'Acessar CRM';
            const linkProps: any = isAcessarCRM ? { target: "_blank", rel: "noopener noreferrer" } : {};

            const tutorialAttr = item.path ? tutorialTargetMap[item.path] : undefined;

            return isCollapsed ? (
              <Tooltip key={`tooltip-${index}`} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link to={item.path || '#'} {...linkProps} className={linkClasses} onClick={(e) => handleLinkClick(e, item.path || '#')} {...(tutorialAttr ? { 'data-tutorial': tutorialAttr } : {})}>
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[#E85D24]" />}
                    <Icon className="h-5 w-5 flex-shrink-0" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.title}</TooltipContent>
              </Tooltip>
            ) : (
              <Link key={`link-${index}`} to={item.path || '#'} {...linkProps} className={linkClasses} onClick={(e) => handleLinkClick(e, item.path || '#')} {...(tutorialAttr ? { 'data-tutorial': tutorialAttr } : {})}>
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[#E85D24]" />}
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                <span className="truncate text-[13px] flex-1">{item.title}</span>
                {item.title === 'Performance' && performancePending > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums px-1">
                    {performancePending}
                  </span>
                )}
                {item.title === 'Configuração Inicial' && showOnboarding && (
                  <span className="ml-auto text-[10px] font-bold text-muted-foreground bg-muted border border-border/60 px-1.5 py-0.5 rounded-md tabular-nums">
                    {onboardingDone}/{onboardingTotal}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Tutorial Button */}
        {!isPlatformMode && !isOutboundMode && (
          <div className={`${isCollapsed ? 'px-2' : 'px-3'} pb-2`}>
            <TutorialHelpButton collapsed={isCollapsed} />
          </div>
        )}

        {/* User Footer */}
        <div className={`${isCollapsed ? 'p-2' : 'px-3 py-3'} border-t border-white/[0.06] flex-shrink-0 space-y-2`}>
          {showBackToAdmin && (
             <Button variant="default" className={`w-full h-8 bg-[#E85D24] hover:bg-[#D04E1A] text-white text-xs ${isCollapsed ? 'justify-center px-0' : 'justify-start px-3'}`} onClick={handleBackToMaster}><ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />{!isCollapsed && <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.06em]">{isImpersonating ? 'Sair do Cliente' : 'Voltar para Admin'}</span>}</Button>
          )}

          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center flex-col' : ''}`}>
            <Avatar className="h-8 w-8 flex-shrink-0 border border-white/[0.08]">
              <AvatarImage src={profile?.url_avatar || ''} />
              <AvatarFallback className="bg-white/[0.08] text-white/70 text-[11px] font-medium">{getInitials(profile?.nome_completo)}</AvatarFallback>
            </Avatar>
            <div className={`flex-1 overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-full opacity-100'}`}>
              <p className="text-[13px] font-medium text-white/80 truncate">{user?.user_metadata?.full_name || profile?.nome_completo || plataformaUser?.clinic_name || 'Colaborador'}</p>
              <p className="text-[10px] text-white/30 truncate w-full block">{user?.email}</p>
            </div>
          </div>
          <div className={`flex ${isCollapsed ? 'flex-col' : ''} gap-1`}>
            {isPlatformMode && (
              <Button variant="ghost" className={`flex-1 h-8 text-white/40 hover:text-white/70 hover:bg-white/[0.05] ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`} onClick={() => navigate('/plataforma/configuracoes')}>
                <Settings className="h-3.5 w-3.5 flex-shrink-0" />
                <span className={`ml-2 text-xs whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>Configurações</span>
              </Button>
            )}
            <Button variant="ghost" className={`${isPlatformMode ? 'flex-1' : 'w-full'} h-8 text-white/40 hover:text-white/70 hover:bg-white/[0.05] ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`} onClick={signOut}><LogOut className="h-3.5 w-3.5 flex-shrink-0" /><span className={`ml-2 text-xs whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>Sair</span></Button>
          </div>
        </div>

        {/* Modal de Onboarding bloqueando saída */}
        <Dialog open={showExitOnboarding} onOpenChange={setShowExitOnboarding}>
          <DialogContent className="sm:max-w-md border-border bg-card">
             <DialogHeader>
                <DialogTitle className="text-foreground font-display">Configuração Incompleta</DialogTitle>
                <DialogDescription>
                  Você ainda não finalizou a configuração inicial e calibração das IAs. Suas respostas ficarão limitadas se sair agora.
                </DialogDescription>
             </DialogHeader>
             <DialogFooter className="sm:justify-start flex gap-2">
               <Button type="button" variant="outline" className="border-border text-foreground hover:bg-muted font-medium flex-1" onClick={() => setShowExitOnboarding(false)}>
                 Continuar Configuração
               </Button>
               <Button type="button" variant="destructive" className="font-medium border-transparent flex-1" onClick={forceExitOnboarding}>
                 Ir assim mesmo
               </Button>
             </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}