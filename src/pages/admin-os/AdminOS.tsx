import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ShieldCheck, LogOut } from 'lucide-react';

import TabVisaoGeral from './tabs/TabVisaoGeral';
import TabClientes from './tabs/TabClientes';
import TabSessoes from './tabs/TabSessoes';
import TabMateriais from './tabs/TabMateriais';
import TabIAs from './tabs/TabIAs';
import TabSistema from './tabs/TabSistema';
import TabSuporte from './tabs/TabSuporte';

export default function AdminOS() {
  const { user } = useAuth();
  const { role, profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('visao_geral');
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  useEffect(() => {
    async function checkAdminRole() {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('platform_admins')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (error || !data || data.role !== 'super_admin') {
          navigate('/plataforma');
        } else {
          setIsCheckingRole(false);
        }
      } catch (err) {
        navigate('/plataforma');
      }
    }
    
    if (!isLoading) {
      if (role === 'superadmin') {
        setIsCheckingRole(false);
      } else {
        checkAdminRole();
      }
    }
  }, [user, isLoading, navigate, role]);

  if (isLoading || isCheckingRole) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E85D24] animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'visao_geral', label: '① Visão Geral' },
    { id: 'clientes', label: '② Clientes' },
    { id: 'sessoes', label: '③ Sessões' },
    { id: 'materiais', label: '④ Materiais' },
    { id: 'ias', label: '⑤ IAs' },
    { id: 'sistema', label: '⑥ Sistema' },
    { id: 'suporte', label: '⑦ Suporte' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-foreground flex flex-col font-sans">
      {/* TOPBAR */}
      <header className="h-16 shrink-0 border-b border-border/10 bg-[#141414] px-6 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-[#E85D24] flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Descompliquei</span>
            <span className="text-sm font-bold text-[#E85D24] uppercase tracking-wider leading-none mt-1">ADMIN OS</span>
          </div>
        </div>

        <nav className="hidden lg:flex items-center h-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-full px-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#E85D24] text-[#E85D24]'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted-foreground">Logado como</p>
            <p className="text-sm font-bold text-foreground">{profile?.nome_completo || 'Super Admin'}</p>
          </div>
          <button
            onClick={() => navigate('/plataforma')}
            className="flex items-center gap-2 h-9 px-4 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase transition-colors"
          >
            Sair do Admin <LogOut className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* MOBILE TABS (if needed) */}
      <div className="lg:hidden w-full overflow-x-auto border-b border-border/10 bg-[#141414] shrink-0 no-scrollbar">
        <div className="flex w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-12 px-4 text-[10px] font-bold tracking-wider uppercase border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#E85D24] text-[#E85D24]'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        {activeTab === 'visao_geral' && <TabVisaoGeral />}
        {activeTab === 'clientes' && <TabClientes />}
        {activeTab === 'sessoes' && <TabSessoes />}
        {activeTab === 'materiais' && <TabMateriais />}
        {activeTab === 'ias' && <TabIAs />}
        {activeTab === 'sistema' && <TabSistema />}
        {activeTab === 'suporte' && <TabSuporte />}
      </main>
    </div>
  );
}
