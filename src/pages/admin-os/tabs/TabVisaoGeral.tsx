import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Route, Bot, Swords, Activity } from 'lucide-react';

interface Metrics {
  clientes: number;
  jornadasAtivas: number;
  conversasHoje: number;
  agentesAtivos: number;
}

export default function TabVisaoGeral() {
  const [metrics, setMetrics] = useState<Metrics>({
    clientes: 0,
    jornadasAtivas: 0,
    conversasHoje: 0,
    agentesAtivos: 0,
  });

  useEffect(() => {
    async function fetchMetrics() {
      const today = new Date().toISOString().slice(0, 10);

      const [clientesRes, jornadasRes, conversasRes, agentesRes] = await Promise.all([
        (supabase as any).from('platform_users').select('id', { count: 'exact', head: true }),
        (supabase as any).from('jornadas').select('id', { count: 'exact', head: true }).eq('status', 'ativa'),
        (supabase as any).from('os_conversations').select('id', { count: 'exact', head: true }).gte('created_at', today),
        (supabase as any).from('athos_agentes').select('id', { count: 'exact', head: true }).eq('ativo', true),
      ]);

      setMetrics({
        clientes: clientesRes.count ?? 0,
        jornadasAtivas: jornadasRes.count ?? 0,
        conversasHoje: conversasRes.count ?? 0,
        agentesAtivos: agentesRes.count ?? 0,
      });
    }

    fetchMetrics();
  }, []);

  const cards = [
    {
      icon: Users,
      label: 'Clientes Plataforma',
      value: metrics.clientes,
      sub: 'usuários ativos',
      color: 'text-white',
    },
    {
      icon: Route,
      label: 'Jornadas Ativas',
      value: metrics.jornadasAtivas,
      sub: 'em andamento',
      color: 'text-violet-400',
    },
    {
      icon: Bot,
      label: 'Conversas com Athos',
      value: metrics.conversasHoje,
      sub: 'iniciadas hoje',
      color: 'text-blue-400',
    },
    {
      icon: Swords,
      label: 'Agentes Ativos',
      value: metrics.agentesAtivos,
      sub: 'no Descompliquei OS',
      color: 'text-emerald-400',
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Visão Geral</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="rounded-xl bg-[#141414] border border-border/10 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-[#141414] border border-border/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/10 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-[#E85D24]" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Atividade Recente</p>
          </div>
          <div className="p-5 text-sm text-muted-foreground text-center">
            Nenhuma atividade registrada hoje.
          </div>
        </div>

        <div className="rounded-xl bg-[#141414] border border-border/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/10">
            <p className="text-[11px] font-bold uppercase tracking-widest text-red-400">Alertas do Sistema</p>
          </div>
          <div className="p-5 text-sm text-muted-foreground text-center">
            Nenhum alerta crítico.
          </div>
        </div>
      </div>
    </div>
  );
}
