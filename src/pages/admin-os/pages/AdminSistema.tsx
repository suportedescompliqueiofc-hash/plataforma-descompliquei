import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Database, HardDrive, Key, CheckCircle2, Trash2,
  RefreshCw, Zap, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DbStats {
  platform_users: number;
  jornadas: number;
  arsenal_aulas: number;
  arsenal_ferramentas: number;
  athos_agentes: number;
  os_conversations: number;
  platform_complementary_materials: number;
}

interface OnboardingStats {
  enabled: number;
  concluido: number;
  complete: number;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={cn('inline-block h-2 w-2 rounded-full flex-shrink-0', ok ? 'bg-emerald-500' : 'bg-red-500')} />
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function SectionCard({ icon: Icon, title, sub, children }: {
  icon: any; title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-muted">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
            {sub && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</p>}
          </div>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export default function AdminSistema() {
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [onboardingStats, setOnboardingStats] = useState<OnboardingStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [cleaningConversas, setCleaningConversas] = useState(false);

  const envOk = {
    url: !!import.meta.env.VITE_SUPABASE_URL,
    key: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  async function fetchStats() {
    setLoadingStats(true);
    try {
      const [
        usersRes, jornadasRes, aulasRes, ferramentasRes,
        agentesRes, conversasRes, materiaisRes,
        enabledRes, concluidoRes, completeRes,
      ] = await Promise.all([
        (supabase as any).from('platform_users').select('id', { count: 'exact', head: true }),
        (supabase as any).from('jornadas').select('id', { count: 'exact', head: true }),
        (supabase as any).from('arsenal_aulas').select('id', { count: 'exact', head: true }).eq('ativo', true),
        (supabase as any).from('arsenal_ferramentas').select('id', { count: 'exact', head: true }).eq('ativo', true),
        (supabase as any).from('athos_agentes').select('id', { count: 'exact', head: true }).eq('ativo', true),
        (supabase as any).from('os_conversations').select('id', { count: 'exact', head: true }),
        (supabase as any).from('platform_complementary_materials').select('id', { count: 'exact', head: true }).eq('ativo', true),
        (supabase as any).from('platform_users').select('id', { count: 'exact', head: true }).eq('platform_onboarding_enabled', true),
        (supabase as any).from('platform_users').select('id', { count: 'exact', head: true }).eq('onboarding_concluido', true),
        (supabase as any).from('platform_users').select('id', { count: 'exact', head: true }).eq('onboarding_complete', true),
      ]);

      setDbStats({
        platform_users: usersRes.count ?? 0,
        jornadas: jornadasRes.count ?? 0,
        arsenal_aulas: aulasRes.count ?? 0,
        arsenal_ferramentas: ferramentasRes.count ?? 0,
        athos_agentes: agentesRes.count ?? 0,
        os_conversations: conversasRes.count ?? 0,
        platform_complementary_materials: materiaisRes.count ?? 0,
      });

      setOnboardingStats({
        enabled: enabledRes.count ?? 0,
        concluido: concluidoRes.count ?? 0,
        complete: completeRes.count ?? 0,
      });
    } catch {
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoadingStats(false);
    }
  }

  async function limparConversasAntigas() {
    if (!confirm('Remover conversas do Athos GS com mais de 30 dias?')) return;
    setCleaningConversas(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const { error, count } = await (supabase as any)
        .from('os_conversations')
        .delete({ count: 'exact' })
        .lt('created_at', cutoff.toISOString());
      if (error) throw error;
      toast.success(`${count ?? 0} conversa(s) removida(s) com sucesso`);
      fetchStats();
    } catch {
      toast.error('Erro ao limpar conversas');
    } finally {
      setCleaningConversas(false);
    }
  }

  useEffect(() => {
    document.title = 'Sistema · Admin OS | Descompliquei';
    fetchStats();
  }, []);

  const edgeFunctions = [
    { name: 'descompliquei-os', label: 'Athos GS / OS', desc: 'Chat com agentes e criação de jornadas' },
    { name: 'whatsapp-ai-agent', label: 'WhatsApp IA', desc: 'Agente de pré-atendimento no CRM' },
    { name: 'receive-message', label: 'Webhook UAZAPI', desc: 'Recepção de mensagens WhatsApp' },
    { name: 'send-quick-message', label: 'Envio de Mensagens', desc: 'Texto, mídia, áudio e citações' },
    { name: 'process-cadences', label: 'Cadências', desc: 'Dispatcher agendado de cadências' },
    { name: 'meta-ads-sync', label: 'Meta Ads Sync', desc: 'Sincronização de campanhas e insights' },
  ];

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-muted">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Sistema & Configurações</h1>
          </div>
          <p className="text-[13px] text-muted-foreground ml-10">Status técnico e dados operacionais da plataforma</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStats}
          disabled={loadingStats}
          className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
        >
          <RefreshCw className={cn('h-3 w-3', loadingStats && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      {/* Supabase + Env + Storage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <SectionCard icon={Database} title="Supabase" sub="Contagem de registros nas tabelas ativas">
            {loadingStats ? (
              <p className="text-[12px] text-muted-foreground">Carregando...</p>
            ) : dbStats && (
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <StatRow label="Clientes (platform_users)" value={dbStats.platform_users} />
                  <StatRow label="Jornadas" value={dbStats.jornadas} />
                  <StatRow label="Conversas (Athos)" value={dbStats.os_conversations} />
                  <StatRow label="Materiais Complementares" value={dbStats.platform_complementary_materials} />
                </div>
                <div>
                  <StatRow label="Aulas do Arsenal" value={dbStats.arsenal_aulas} />
                  <StatRow label="Ferramentas do Arsenal" value={dbStats.arsenal_ferramentas} />
                  <StatRow label="Agentes do Athos" value={dbStats.athos_agentes} />
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard icon={Key} title="Variáveis de Ambiente">
            <div className="space-y-2.5">
              {[
                { key: 'VITE_SUPABASE_URL', ok: envOk.url },
                { key: 'VITE_SUPABASE_ANON_KEY', ok: envOk.key },
              ].map(({ key, ok }) => (
                <div key={key} className="flex items-center gap-2">
                  <StatusDot ok={ok} />
                  <span className="text-[11px] font-mono text-muted-foreground truncate">{key}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard icon={HardDrive} title="Storage" sub="Bucket platform-complementary">
            <div className="flex items-center gap-2">
              <StatusDot ok={true} />
              <span className="text-[12px] text-muted-foreground">Ativo · PDFs + HTML · 50 MB/arquivo</span>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Onboarding Stats */}
      <SectionCard icon={CheckCircle2} title="Onboarding da Plataforma" sub="Funil de ativação dos clientes">
        {loadingStats ? (
          <p className="text-[12px] text-muted-foreground">Carregando...</p>
        ) : onboardingStats && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Onboarding Ativo', value: onboardingStats.enabled, color: 'text-blue-500', sub: 'platform_onboarding_enabled' },
              { label: 'Athos Concluído', value: onboardingStats.concluido, color: 'text-violet-500', sub: 'onboarding_concluido' },
              { label: 'Checklist Completo', value: onboardingStats.complete, color: 'text-emerald-500', sub: 'onboarding_complete' },
            ].map(({ label, value, color, sub }) => (
              <div key={label} className="rounded-xl bg-muted/30 border border-border/40 px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
                <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
                <p className="text-[10px] font-mono text-muted-foreground/50">{sub}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Edge Functions */}
      <SectionCard icon={Zap} title="Edge Functions" sub="Supabase Deno — funções deployadas">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {edgeFunctions.map(({ name, label, desc }) => (
            <div key={name} className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
              <StatusDot ok={true} />
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-foreground leading-tight">{label}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">{desc}</p>
                <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">{name}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Manutenção */}
      <SectionCard icon={Trash2} title="Manutenção" sub="Ações operacionais de limpeza de dados">
        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">Limpar conversas antigas</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
              Remove conversas do Athos GS com mais de 30 dias de <code className="font-mono">os_conversations</code>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={limparConversasAntigas}
            disabled={cleaningConversas}
            className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3 shrink-0 ml-4"
          >
            {cleaningConversas ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Limpar
          </Button>
        </div>
      </SectionCard>

    </div>
  );
}
