import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { MASTER_ORG_ID } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, Users, Calendar,
  ShieldCheck, ChevronRight, Menu, X, Package, MonitorSmartphone,
  MessageSquare, LogOut, Settings, Swords, Route, Sparkles, LifeBuoy,
  Bell, ExternalLink, Clock, HeartHandshake, Megaphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard',        path: '/admin',          exact: true, badgeType: 'none' },
  { icon: Sparkles,        label: 'Athos Admin',      path: '/admin/athos',    badgeType: 'none' },
  { icon: Users,           label: 'Clientes',          path: '/admin/clientes',  badgeType: 'inactive_clients' },
  { icon: HeartHandshake,  label: 'Customer Success',  path: '/admin/cs',        badgeType: 'none' },
  { icon: Swords,          label: 'Arsenal Comercial', path: '/admin/arsenal',   badgeType: 'none' },
  { icon: Calendar,        label: 'Sessões Táticas',  path: '/admin/sessoes',  badgeType: 'none' },
  { icon: Package,         label: 'Produtos',         path: '/admin/produtos',    badgeType: 'none' },
  { icon: Megaphone,       label: 'Atualizações',     path: '/admin/atualizacoes', badgeType: 'none' },
  { icon: Settings,        label: 'Sistema & Config', path: '/admin/sistema',     badgeType: 'none' },
  { icon: LifeBuoy,        label: 'Suporte',          path: '/admin/suporte',  badgeType: 'none' },
];

type AdminNotif = {
  id: string;
  numero_ticket: number;
  titulo: string;
  organization_id: string;
  created_at: string;
  read: boolean;
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useProfile();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [badges, setBadges] = useState({ inactive_clients: 0, delayed_tasks: 0, today: 0 });
  const [notifications, setNotifications] = useState<AdminNotif[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const queryClient = useQueryClient();
  const restoredRef = useRef(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Garantir org master ao entrar no AdminOS
  useEffect(() => {
    if (!user || !profile || restoredRef.current) return;
    if (profile.organization_id !== MASTER_ORG_ID) {
      restoredRef.current = true;
      supabase.from('perfis')
        .update({ organization_id: MASTER_ORG_ID } as any)
        .eq('id', user.id)
        .then(() => {
          localStorage.removeItem('original_master_org_id');
          queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
        });
    }
  }, [user, profile, queryClient]);

  useEffect(() => {
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
        let delayed = 0; let today = 0;
        if (tasks) {
          tasks.forEach(t => {
            if (!t.due_date) return;
            const tDate = t.due_date.substring(0, 10);
            if (tDate < hojeStr) delayed++;
            else if (tDate === hojeStr) today++;
          });
        }
        setBadges({ inactive_clients: clientsCount || 0, delayed_tasks: delayed, today });
      } catch (err) { console.error('Erro ao carregar badges:', err); }
    }
    loadBadges();
  }, [location.pathname]);

  // Realtime — novo ticket de suporte → notificação no sino
  useEffect(() => {
    const channel = supabase
      .channel('admin-suporte-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'suporte_tickets' }, (payload) => {
        const ticket = payload.new as any;
        setNotifications(prev => [{
          id: ticket.id,
          numero_ticket: ticket.numero_ticket,
          titulo: ticket.titulo,
          organization_id: ticket.organization_id,
          created_at: ticket.created_at || new Date().toISOString(),
          read: false,
        }, ...prev].slice(0, 50)); // máximo 50 notificações
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fechar painel ao clicar fora
  useEffect(() => {
    if (!showNotif) return;
    const handler = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotif]);

  const handleOpenNotif = () => {
    setShowNotif(prev => !prev);
    // Marca todas como lidas ao abrir
    if (!showNotif) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const isActive = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const currentItem = navItems.find(i => isActive(i.path, i.exact));
  const isFullBleed = location.pathname.startsWith('/admin/athos');

  const SidebarContent = () => (
    <>
      {/* Logo / Título */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
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

        <div className="flex items-center gap-1">
          {/* Sino de notificações */}
          <button
            onClick={handleOpenNotif}
            className={cn(
              'relative h-8 w-8 flex items-center justify-center rounded-lg transition-all',
              showNotif
                ? 'bg-white/[0.12] text-white'
                : 'text-white/40 hover:text-white hover:bg-white/[0.06]'
            )}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* X mobile */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden h-8 w-8 flex items-center justify-center text-white/40 hover:text-white rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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
            <p className="text-xs font-semibold truncate text-white/80 font-body">{profile?.nome_completo || 'Admin'}</p>
            <p className="text-[10px] text-white/30 font-medium">Superadmin</p>
          </div>
        </div>

        <div className="space-y-0.5 pt-1">
          <p className="px-3 text-[9px] uppercase tracking-widest font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Visualizar como
          </p>
          {[
            { icon: MessageSquare,    label: 'Ver CRM',       path: '/crm' },
            { icon: MonitorSmartphone,label: 'Ver Plataforma',path: '/plataforma' },
          ].map(({ icon: Icon, label, path }) => (
            <button key={path} onClick={() => navigate(path)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-all rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.04]">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="font-body">{label}</span>
            </button>
          ))}
        </div>

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
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside
        className={`w-64 shrink-0 flex flex-col fixed inset-y-0 left-0 z-30 transition-transform duration-300 ease-in-out lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'hsl(220 10% 10%)', borderRight: '1px solid hsl(220 10% 16%)' }}
      >
        <SidebarContent />
      </aside>

      {/* PAINEL DE NOTIFICAÇÕES */}
      {showNotif && (
        <div
          ref={notifPanelRef}
          className="fixed left-64 top-0 bottom-0 w-80 z-40 flex flex-col bg-background border-r border-border shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/[0.03] shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-bold text-foreground font-display">Notificações</p>
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={() => setNotifications([])}
                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpar
                </button>
              )}
              <button
                onClick={() => setShowNotif(false)}
                className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <Bell className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhuma notificação</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                  Novas solicitações de suporte aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {notifications.map(n => (
                  <div key={n.id} className="px-4 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-red-500/10 shrink-0 mt-0.5">
                        <LifeBuoy className="h-3.5 w-3.5 text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground leading-snug">
                          Nova solicitação de suporte
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          #{n.numero_ticket} · {n.titulo}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground/40" />
                          <span className="text-[10px] text-muted-foreground/50">
                            {format(parseISO(n.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}
                          </span>
                          <button
                            onClick={() => { navigate('/admin/suporte'); setShowNotif(false); }}
                            className="ml-auto flex items-center gap-1 text-[10px] font-medium text-foreground hover:text-foreground/70 transition-colors"
                          >
                            Ver <ExternalLink className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border/40 bg-muted/[0.02] shrink-0">
            <button
              onClick={() => { navigate('/admin/suporte'); setShowNotif(false); }}
              className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors"
            >
              <LifeBuoy className="h-3.5 w-3.5" />
              Ver Central de Suporte
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-64 min-h-screen overflow-x-hidden bg-background flex flex-col">
        {/* HEADER MOBILE */}
        <header className="flex items-center gap-4 lg:hidden px-6 py-4 border-b border-border bg-background/95 backdrop-blur z-10 sticky top-0">
          <button onClick={() => setIsMobileOpen(true)} className="p-2 -ml-2 rounded-md hover:bg-muted text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-[#E85D24] uppercase tracking-wider text-sm">ADMIN OS</span>
        </header>

        {isFullBleed ? (
          <div className="flex-1 min-h-0">
            <Outlet />
          </div>
        ) : (
          <div className="p-6 lg:p-8 flex-1">
            <div className="flex items-center gap-1.5 mb-6">
              <button onClick={() => navigate('/admin')} className="text-[11px] font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors uppercase tracking-wider">Admin OS</button>
              <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{currentItem?.label || 'Página'}</span>
            </div>
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
