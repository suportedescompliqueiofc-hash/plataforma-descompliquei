import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, BarChart3, Settings, LogOut, ChevronLeft,
  MessageSquare, Bell, ShoppingCart, Bot, GitMerge, GitBranch, ShieldCheck,
  Calendar, Target, CalendarDays, ImagePlay, PenLine,
  Phone, FileText, Stethoscope, Trophy, Rocket, TrendingUp, Sparkles, Swords, Route, UsersRound, Megaphone,
  NotebookText
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { useAtualizacoes } from "@/hooks/useAtualizacoes";

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
  const { naoVistosCount: atualizacoesNaoVistas } = useAtualizacoes();

  const isSuperAdmin = role === 'superadmin';
  const permissions = usePermissions();
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

  // Acesso a qualquer recurso da Plataforma (Aprendizado). Superadmin sempre tem.
  const temPlataforma =
    isSuperAdmin ||
    acesso.acesso_sessoes_taticas ||
    acesso.acesso_materiais ||
    acesso.acesso_ia_comercial ||
    (acesso.ias_liberadas?.length ?? 0) > 0;

  const isDescompliqueiOrg = profile?.organization_id === DESCOMPLIQUEI_ORG_ID;

  // Durante o loading, manter os itens visíveis (evitar flicker na navegação)
  const temOS = plataformaLoading || acesso.acesso_os;
  // CRM é uma ÁREA entitled: só aparece se o produto liberar acesso_crm (superadmin = ACESSO_TOTAL).
  const temCrm = plataformaLoading || acesso.acesso_crm;

  // Membros de equipe operam só no CRM — seções de Aprendizado ficam ocultas.
  const showAprendizado = temPlataforma && !isMember;

  // MENU ÚNICO INTEGRADO — CRM + Plataforma numa sidebar só (sem pula-pula).
  type MenuItem = {
    title: string;
    isSeparator?: boolean;
    icon?: LucideIcon;
    path?: string;
    accessKey?: keyof typeof acesso;
    superadminOnly?: boolean;
  };
  const unifiedMenuItems: MenuItem[] = [
    ...(showOnboarding ? [{ title: "Configuração Inicial", icon: Rocket, path: "/crm/onboarding" }] : []),
    { title: "Atualizações", icon: Megaphone, path: "/crm/atualizacoes" },
    // ── ÁREA CRM (gated por acesso_crm) ──────────────────────────────────────
    ...(temCrm ? [
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
      { title: "Equipe", icon: UsersRound, path: "/crm/equipe" },
      { title: "Evolução", icon: TrendingUp, path: "/crm/evolucao" },
    ] : []),
    // ── ÁREA INTELIGÊNCIA (Athos) — só o separador se houver algum item ───────
    ...((temCrm || temOS) ? [
      { isSeparator: true, title: "Inteligência" },
      ...(temCrm ? [{ title: "Agentes de IA", icon: Bot, path: "/crm/athos" }] : []),
      ...(temOS ? [{ title: "Athos", icon: Sparkles, path: "/plataforma/athos-gs" }] : []),
    ] : []),
    // ── ÁREA APRENDIZADO (Plataforma) ────────────────────────────────────────
    ...(showAprendizado ? [
      { isSeparator: true, title: "Aprendizado" },
      { title: "Arsenal", icon: Swords, path: "/plataforma/arsenal" },
      { title: "Jornada", icon: Route, path: "/plataforma/jornada" },
      { title: "Notas", icon: NotebookText, path: "/crm/notas", accessKey: 'acesso_materiais' as const },
      { title: "Sessões Táticas", icon: Calendar, path: "/plataforma/sessoes-taticas", accessKey: 'acesso_sessoes_taticas' as const },
      { title: "Clube One", icon: Trophy, path: "/plataforma/clube-one" },
    ] : []),
    // ── ÁREA AUTOMAÇÃO (CRM) ─────────────────────────────────────────────────
    ...(temCrm ? [
      { isSeparator: true, title: "Automação" },
      { title: "Cadências", icon: GitMerge, path: "/crm/cadences" },
    ] : []),
    // ── MARKETING / PROSPECÇÃO (Descompliquei-only, implica CRM) ──────────────
    ...((isDescompliqueiOrg && temCrm) ? [
      { isSeparator: true, title: "Marketing" },
      { title: "Tráfego", icon: BarChart3, path: "/crm/marketing-trafego" },
      { title: "Criativos", icon: ImagePlay, path: "/crm/criativos" },
      { title: "Canvas", icon: PenLine, path: "/crm/canvas" },
      { isSeparator: true, title: "Prospecção" },
      { title: "Outbound", icon: Phone, path: "/outbound/painel" },
    ] : []),
    // ── SISTEMA — separador só se houver algum item ───────────────────────────
    ...((temCrm || showAprendizado || isSuperAdmin) ? [
      { isSeparator: true, title: "Sistema" },
      { title: "Configurações", icon: Settings, path: "/crm/settings" },
      { title: "Super Admin CRM", icon: ShieldCheck, path: "/crm/super-admin-crm", superadminOnly: true },
      { title: "Super Admin", icon: ShieldCheck, path: "/admin", superadminOnly: true },
    ] : []),
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
    '/crm/equipe':             'equipe',
    '/crm/cadences':           'cadencias',
    '/crm/ia':                 'ia',
    '/crm/athos':              'ia',
    '/crm/settings':           'configuracoes',
    '/plataforma':             'plataforma',
  };

  // Chaves que partem como `true` em ACESSO_TOTAL mas devem ser `false` para membros.
  // Escondê-las durante o loading evita o flash antes da detecção de membro terminar.
  const MEMBER_RESTRICTED_KEYS = new Set(['acesso_materiais']);

  const menuItems = isOutboundMode
    ? outboundMenuItems
    : unifiedMenuItems.filter((item) => {
        if (item.superadminOnly && !isSuperAdmin) return false;
        if (item.isSeparator) return true;
        if (!item.path) return true;

        // Itens da Plataforma (Aprendizado): gate por accessKey; sem flicker durante o loading
        const isPlataformaItem = item.path.startsWith('/plataforma') || !!item.accessKey;
        if (isPlataformaItem) {
          if (plataformaLoading) return true;
          if (item.accessKey && !acesso[item.accessKey]) return false;
          return true;
        }

        // Itens do CRM: permissões do papel
        if (permissions.isOwner) return true;
        // Configurações sempre visível — contém perfil pessoal e senha
        if (item.path === '/crm/settings') return true;
        const permKey = PATH_PERMISSION_MAP[item.path];
        // Sem mapeamento (ex: marketing, criativos, /admin): apenas donos/superadmin
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
    '/crm/atualizacoes': 'sidebar-atualizacoes',
    '/crm/conversas': 'sidebar-conversas',
    '/crm/notificacoes': 'sidebar-notificacoes',
    '/crm/leads': 'sidebar-leads',
    '/crm/agendamentos': 'sidebar-agendamentos',
    '/crm/vendas': 'sidebar-vendas',
    '/crm/procedimentos': 'sidebar-procedimentos',
    '/crm/metas': 'sidebar-metas',
    '/crm/cadences': 'sidebar-cadences',
    '/crm/ia': 'sidebar-ia',
    '/crm/athos': 'sidebar-athos',
    '/crm/settings': 'sidebar-settings',
    // Plataforma
    '/plataforma': 'sidebar-hub',
    '/plataforma/arsenal': 'sidebar-arsenal',
    '/crm/notas': 'sidebar-notas',
    '/plataforma/sessoes-taticas': 'sidebar-sessoes',
    '/plataforma/athos-gs': 'sidebar-os',
    '/plataforma/jornada': 'sidebar-jornada',
    '/crm/evolucao': 'sidebar-evolucao',
    '/crm/equipe': 'sidebar-equipe',
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
              <h1 className="text-[13px] font-semibold text-sidebar-foreground leading-tight truncate">{isOutboundMode ? 'Prospecção Ativa' : branding?.brand_name || 'CRM'}</h1>
              <p className="text-[10px] text-white/40 tracking-wide truncate">{isOutboundMode ? 'Outbound' : branding?.tagline || 'Gestão Inteligente'}</p>
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

            const linkClasses = `flex items-center gap-3 py-2 rounded-md transition-all duration-150 relative ${isCollapsed ? 'justify-center px-2' : 'px-3'} ${isActive ? 'bg-primary/[0.12] text-white font-medium' : 'text-white/50 hover:bg-white/[0.05] hover:text-white/80'}`;

            const isAcessarCRM = item.title === 'Acessar CRM';
            const linkProps: any = isAcessarCRM ? { target: "_blank", rel: "noopener noreferrer" } : {};

            const tutorialAttr = item.path ? tutorialTargetMap[item.path] : undefined;

            return isCollapsed ? (
              <Tooltip key={`tooltip-${index}`} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link to={item.path || '#'} {...linkProps} className={linkClasses} onClick={(e) => handleLinkClick(e, item.path || '#')} {...(tutorialAttr ? { 'data-tutorial': tutorialAttr } : {})}>
                    {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />}
                    <Icon className="h-5 w-5 flex-shrink-0" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.title}</TooltipContent>
              </Tooltip>
            ) : (
              <Link key={`link-${index}`} to={item.path || '#'} {...linkProps} className={linkClasses} onClick={(e) => handleLinkClick(e, item.path || '#')} {...(tutorialAttr ? { 'data-tutorial': tutorialAttr } : {})}>
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />}
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                <span className="truncate text-[13px] flex-1">{item.title}</span>
                {item.title === 'Performance' && performancePending > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums px-1">
                    {performancePending}
                  </span>
                )}
                {item.title === 'Atualizações' && atualizacoesNaoVistas > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums px-1">
                    {atualizacoesNaoVistas}
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
        {!isOutboundMode && (
          <div className={`${isCollapsed ? 'px-2' : 'px-3'} pb-2`}>
            <TutorialHelpButton collapsed={isCollapsed} />
          </div>
        )}

        {/* User Footer */}
        <div className={`${isCollapsed ? 'p-2' : 'px-3 py-3'} border-t border-white/[0.06] flex-shrink-0 space-y-2`}>
          {showBackToAdmin && (
             <Button variant="default" className={`w-full h-8 bg-primary hover:bg-primary/90 text-white text-xs ${isCollapsed ? 'justify-center px-0' : 'justify-start px-3'}`} onClick={handleBackToMaster}><ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />{!isCollapsed && <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.06em]">{isImpersonating ? 'Sair do Cliente' : 'Voltar para Admin'}</span>}</Button>
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
            <Button variant="ghost" className={`w-full h-8 text-white/40 hover:text-white/70 hover:bg-white/[0.05] ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`} onClick={signOut}><LogOut className="h-3.5 w-3.5 flex-shrink-0" /><span className={`ml-2 text-xs whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>Sair</span></Button>
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