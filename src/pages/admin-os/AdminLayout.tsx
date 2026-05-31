import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { MASTER_ORG_ID } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, Users, PlayCircle, Zap, Calendar,
  ShieldCheck, ChevronRight, Menu, X, Package, MonitorSmartphone, MessageSquare, LogOut, Trophy, BarChart2, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard',                 path: '/admin',           exact: true, badgeType: 'none' },
  { icon: Users,           label: 'Clientes',                  path: '/admin/clientes',  badgeType: 'inactive_clients' },
  { icon: Trophy,          label: 'Performance CRM',           path: '/admin/performance', badgeType: 'none' },
  { icon: PlayCircle,      label: 'Trilha de Aprendizado',     path: '/admin/trilha',    badgeType: 'none' },
  { icon: Zap,             label: 'Inteligências Artificiais', path: '/admin/ias',       badgeType: 'none' },
  { icon: Calendar,        label: 'Sessões Táticas',           path: '/admin/sessoes',   badgeType: 'none' },
  { icon: BarChart2,       label: 'Relatórios',                path: '/admin/relatorios',badgeType: 'none' },
  { icon: Package,         label: 'Produtos',                  path: '/admin/produtos',  badgeType: 'none' },
  { icon: Settings,        label: 'Sistema & Config',          path: '/admin/sistema',   badgeType: 'none' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useProfile();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [badges, setBadges] = useState({ inactive_clients: 0, delayed_tasks: 0, today: 0 });
  const queryClient = useQueryClient();
  const restoredRef = useRef(false);

  // Garantir que o admin sempre esteja na org master ao entrar no AdminOS
  useEffect(() => {
    if (!user || !profile || restoredRef.current) return;
    if (profile.organization_id !== MASTER_ORG_ID) {
      restoredRef.current = true;
      supabase.from('perfis')
        .update({ organization_id: MASTER_ORG_ID } as any)
        .eq('id', user.id)
        .then(() => {
          localStorage.removeItem('original_master_org_id');
          // Invalida cache do profile para re-fetch imediato
          queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
        });
    }
  }, [user, profile, queryClient]);

  useEffect(() => {
    // Close sidebar on navigate
    setIsMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    async function loadBadges() {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { count: clientsCount } = await supabase
          .from('platform_users')
          .select('*', { count: 'exact', head: true })
          .lt('updated_at', sevenDaysAgo.toISOString());
          
        const hojeStr = new Date().toISOString().substring(0, 10);
        
        const { data: tasks } = await supabase.from('admin_tasks').select('status, due_date').neq('status', 'concluida');
        
        let delayed = 0;
        let today = 0;
        if (tasks) {
          tasks.forEach(t => {
              if (!t.due_date) return;
              const tDate = t.due_date.substring(0, 10);
              if (tDate < hojeStr) delayed++;
              else if (tDate === hojeStr) today++;
          });
        }
        
        setBadges({
          inactive_clients: clientsCount || 0,
          delayed_tasks: delayed,
          today: today
        });
      } catch (err) {
        console.error("Erro ao carregar badges:", err);
      }
    }
    loadBadges();
  }, [location.pathname]); // Reload badges on navigation

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const currentItem = navItems.find(i => isActive(i.path, i.exact));

  const SidebarContent = () => (
    <>
      {/* Logo / Título */}
      <div className="px-5 pt-6 pb-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <ShieldCheck className="h-4 w-4 text-white/70" />
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest leading-none" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Descompliquei
            </div>
            <div className="text-sm font-bold text-white uppercase tracking-[0.18em] leading-tight mt-0.5 font-display">
              ADMIN OS
            </div>
          </div>
        </div>
        <button onClick={() => setIsMobileOpen(false)} className="lg:hidden text-white/40 hover:text-white p-1 rounded-lg transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mx-4 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item.path, item.exact);
          const badgeValue = badges[item.badgeType as keyof typeof badges];

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium transition-all rounded-lg',
                active
                  ? 'bg-white/[0.92] text-[hsl(220,10%,12%)] shadow-sm'
                  : 'text-white/45 hover:text-white hover:bg-white/[0.06]'
              )}
            >
              <div className="flex items-center gap-2.5 truncate">
                <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-[hsl(220,10%,20%)]' : '')} />
                <span className="truncate font-body">{item.label}</span>
              </div>

              {badgeValue > 0 && (
                <div className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 leading-none flex items-center justify-center min-w-[18px] h-[18px]',
                  active ? 'bg-black/10 text-[hsl(220,10%,20%)]' : 'bg-white/15 text-white'
                )}>
                  {badgeValue > 99 ? '99+' : badgeValue}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mx-4 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Footer */}
      <div className="px-3 py-4 space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <span className="text-xs font-bold text-white/80">
              {(profile?.nome_completo || 'A').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate text-white/80 font-body">
              {profile?.nome_completo || 'Admin'}
            </p>
            <p className="text-[10px] text-white/30 font-medium">Superadmin</p>
          </div>
        </div>

        {/* Acesso rápido para visualização */}
        <div className="space-y-0.5 pt-1">
          <p className="px-3 text-[9px] uppercase tracking-widest font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Visualizar como
          </p>
          {[
            { icon: MessageSquare, label: 'Ver CRM', path: '/crm' },
            { icon: MonitorSmartphone, label: 'Ver Plataforma', path: '/plataforma' },
          ].map(({ icon: Icon, label, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.04]"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="font-body">{label}</span>
            </button>
          ))}
        </div>

        {/* Sair */}
        <div className="pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.08]"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span className="font-body">Sair</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* OVERLAY MOBILE */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-20 lg:hidden" 
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`w-64 shrink-0 flex flex-col fixed inset-y-0 left-0 z-30 transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'hsl(220 10% 10%)', borderRight: '1px solid hsl(220 10% 16%)' }}
      >
        <SidebarContent />
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-64 min-h-screen overflow-x-hidden bg-background flex flex-col">
        {/* HEADER MOBILE */}
        <header className="flex items-center gap-4 lg:hidden px-6 py-4 border-b border-border bg-background/95 backdrop-blur z-10 sticky top-0">
          <button onClick={() => setIsMobileOpen(true)} className="p-2 -ml-2 rounded-md hover:bg-muted text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-[#E85D24] uppercase tracking-wider text-sm">ADMIN OS</span>
        </header>

        <div className="p-6 lg:p-8 flex-1">
          {/* BREADCRUMBS */}
          <div className="flex items-center gap-1.5 mb-6">
            <button onClick={() => navigate('/admin')} className="text-[11px] font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors uppercase tracking-wider">Admin OS</button>
            <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{currentItem?.label || 'Página'}</span>
          </div>

          <Outlet />
        </div>
      </main>
    </div>
  );
}
