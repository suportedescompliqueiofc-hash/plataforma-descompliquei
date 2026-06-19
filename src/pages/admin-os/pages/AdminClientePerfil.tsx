import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Activity, KeyRound, Trophy, RotateCcw, Users, Copy, Check, BarChart3, Send } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import AbaVisaoGeral from './cliente/AbaVisaoGeral';
import AbaPerformance from './cliente/AbaPerformance';
import AbaEngajamento, { type EngajamentoData } from './cliente/AbaEngajamento';
import AdminAcessoCliente from './AdminAcessoCliente';

type Tab = 'geral' | 'engajamento' | 'performance' | 'acessos';

const ALL_TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'geral',        label: 'Visão Geral',  icon: Activity  },
  { id: 'engajamento',  label: 'Engajamento',   icon: BarChart3 },
  { id: 'performance',  label: 'Performance',   icon: Trophy    },
  { id: 'acessos',      label: 'Acessos',       icon: KeyRound  },
];

interface PlatformData {
  onboardingConcluido: boolean;
  onboardingComplete: boolean;
  jornada: { id: string; titulo: string; status: string } | null;
  passosTotal: number;
  passosConcluidos: number;
  aulasArsenalConcluidas: number;
  osConversas: number;
}

export default function AdminClientePerfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('geral');
  const [loading, setLoading] = useState(true);

  const [client, setClient] = useState<any>(null);
  const [platformData, setPlatformData] = useState<PlatformData | null>(null);
  const [engajamentoData, setEngajamentoData] = useState<EngajamentoData | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resending, setResending] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopyId() {
    if (!client?.organization_id) return;
    navigator.clipboard.writeText(client.organization_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleResetOnboarding() {
    if (!client?.id) return;
    setResetting(true);
    try {
      const { error } = await (supabase as any).rpc('admin_reset_onboarding_to_athos', {
        p_platform_user_id: client.id,
        p_auth_user_id: client.crm_user_id,
      });
      if (error) throw error;
      toast.success('Onboarding reiniciado com sucesso');
      loadAll();
    } catch (err: any) {
      console.error('Erro ao reiniciar onboarding:', err);
      toast.error('Erro ao reiniciar onboarding');
    } finally {
      setResetting(false);
    }
  }

  async function handleResendAccess() {
    if (!client?.email) return;
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-platform-user', {
        body: {
          email: client.email,
          clinic_name: client.org_name || client.clinic_name || client.nome_completo,
          product_id: client.product_id ?? null,
          trial_ends_at: client.trial_ends_at ?? null,
          send_welcome: true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('E-mail de acesso reenviado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reenviar acesso.');
    } finally {
      setResending(false);
    }
  }

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Perfil do usuário na org
      const { data: perfisOrg } = await supabase
        .from('perfis')
        .select('id, nome_completo, email')
        .eq('organization_id', id)
        .order('criado_em', { ascending: true });

      const perfil = perfisOrg?.[0] ?? null;

      let puId: string | null = null;
      let puData: any = null;

      if (perfil?.id) {
        const { data: pu } = await supabase
          .from('platform_users')
          .select('*')
          .eq('crm_user_id', perfil.id)
          .maybeSingle();
        if (pu) {
          puId = pu.id;
          puData = { ...pu, email: perfil.email, nome_completo: perfil.nome_completo };
        }
      }

      if (!puData && perfil) {
        puData = { email: perfil.email, nome_completo: perfil.nome_completo };
      }

      // 2. Org + tenant + produto
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', id)
        .maybeSingle();

      const { data: tenant } = await supabase
        .from('platform_tenants')
        .select('product_id, status, trial_ends_at, created_at')
        .eq('organization_id', id)
        .maybeSingle();

      let product_name: string | null = null;
      if (tenant?.product_id) {
        const { data: prod } = await supabase
          .from('platform_products')
          .select('nome')
          .eq('id', tenant.product_id)
          .maybeSingle();
        product_name = prod?.nome ?? null;
      }

      setClient(puData ? {
        ...puData,
        org_name: org?.name ?? null,
        organization_id: id,
        product_name,
        product_id: tenant?.product_id ?? null,
        tenant_status: tenant?.status ?? null,
        trial_ends_at: tenant?.trial_ends_at ?? null,
        tenant_created_at: tenant?.created_at ?? null,
      } : null);

      // 3. Dados da plataforma (só se existir platform_user)
      if (puId) {
        const [jornadaRes, aulasRes, osRes] = await Promise.all([
          supabase.from('jornadas').select('id, titulo, status').eq('user_id', puId).maybeSingle(),
          supabase.from('arsenal_aulas_progresso').select('id', { count: 'exact', head: true }).eq('user_id', puId).eq('concluido', true),
          supabase.from('os_conversations').select('id', { count: 'exact', head: true }).eq('user_id', puId),
        ]);

        let passosTotal = 0;
        let passosConcluidos = 0;

        if (jornadaRes.data?.id) {
          const { data: estagios } = await supabase
            .from('jornada_estagios')
            .select('id, jornada_passos(id, concluido)')
            .eq('jornada_id', jornadaRes.data.id);

          if (estagios) {
            for (const e of estagios) {
              const passos = (e as any).jornada_passos || [];
              passosTotal += passos.length;
              passosConcluidos += passos.filter((p: any) => p.concluido).length;
            }
          }
        }

        setPlatformData({
          onboardingConcluido: puData?.onboarding_concluido === true,
          onboardingComplete: puData?.onboarding_complete === true,
          jornada: jornadaRes.data ?? null,
          passosTotal,
          passosConcluidos,
          aulasArsenalConcluidas: aulasRes.count || 0,
          osConversas: osRes.count || 0,
        });

        // 4. Dados de engajamento (diagnóstico, jornada detalhada, aulas, conversas)
        const [diagRes, aulasDetRes, convsRes] = await Promise.all([
          (supabase as any).from('onboarding_diagnosticos').select('respostas').eq('user_id', puId).maybeSingle(),
          (supabase as any).from('arsenal_aulas_progresso').select('concluido_em, arsenal_aulas(nome)').eq('user_id', puId).eq('concluido', true).order('concluido_em', { ascending: false }),
          (supabase as any).from('os_conversations').select('titulo, agente_slug, criado_em').eq('user_id', puId).order('criado_em', { ascending: false }),
        ]);

        let estagiosDetalhados: EngajamentoData['estagios'] = [];
        if (jornadaRes.data?.id) {
          const { data: estDet } = await (supabase as any)
            .from('jornada_estagios')
            .select('titulo, descricao, ordem, jornada_passos(titulo, concluido, concluido_em, ordem)')
            .eq('jornada_id', jornadaRes.data.id)
            .order('ordem', { ascending: true });

          if (estDet) {
            estagiosDetalhados = estDet
              .sort((a: any, b: any) => a.ordem - b.ordem)
              .map((e: any) => ({
                titulo: e.titulo,
                descricao: e.descricao,
                passos: (e.jornada_passos || [])
                  .sort((a: any, b: any) => a.ordem - b.ordem)
                  .map((p: any) => ({ titulo: p.titulo, concluido: p.concluido === true, concluido_em: p.concluido_em })),
              }));
          }
        }

        setEngajamentoData({
          diagnostico: diagRes.data?.respostas ?? null,
          estagios: estagiosDetalhados,
          jornadaTitulo: jornadaRes.data?.titulo ?? null,
          jornadaStatus: jornadaRes.data?.status ?? null,
          aulasConcluidas: (aulasDetRes.data || []).map((a: any) => ({
            nome: a.arsenal_aulas?.nome ?? 'Aula desconhecida',
            concluido_em: a.concluido_em,
          })),
          conversas: convsRes.data || [],
        });
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
    </div>
  );

  if (!client) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-3 rounded-xl bg-muted/40 mb-3">
        <Users className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Cliente não encontrado</p>
      <button className="mt-3 text-xs text-muted-foreground/60 hover:text-foreground transition-colors flex items-center gap-1" onClick={() => navigate('/admin/clientes')}>
        <ArrowLeft className="h-3 w-3" /> Voltar para Clientes
      </button>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER */}
      <div>
        <button onClick={() => navigate('/admin/clientes')} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60 hover:text-muted-foreground mb-5 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Clientes
        </button>

        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className={cn('h-[3px] w-full', client.tenant_status === 'bloqueado' ? 'bg-red-400/60' : 'bg-foreground/10')} />

          <div className="p-6">
            <div className="flex flex-wrap items-start gap-5">
              {/* Avatar */}
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center shrink-0 border border-border/40">
                <span className="text-xl font-black text-foreground/60">{(client.org_name || client.clinic_name || client.nome_completo || 'C').charAt(0)}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground font-display leading-tight">{client.org_name || client.clinic_name || client.nome_completo || 'Sem nome'}</h1>
                  {client.product_name && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/60">
                      {client.product_name}
                    </span>
                  )}
                  {client.tenant_status === 'bloqueado' && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200/60">
                      Bloqueado
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground">{client.email || '—'}</p>
                <button
                  onClick={handleCopyId}
                  className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors mt-0.5"
                  title="Copiar ID da organização"
                >
                  {client.organization_id}
                  {copied
                    ? <Check className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                    : <Copy className="h-2.5 w-2.5 shrink-0" />
                  }
                </button>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Reenviar Acesso */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-40"
                      disabled={resending}
                    >
                      {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Reenviar Acesso
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reenviar e-mail de acesso?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Um novo link de acesso será gerado e enviado para <strong>{client.email}</strong>. O link anterior será invalidado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResendAccess}>
                        Reenviar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Reiniciar Onboarding */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-semibold border border-red-200/60 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                      disabled={resetting}
                    >
                      {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      Reiniciar
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reiniciar onboarding do cliente?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso vai apagar todo o progresso do diagnóstico, jornada e materiais do onboarding.
                        O cliente será redirecionado ao fluxo inicial como se fosse a primeira vez.
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetOnboarding} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Sim, reiniciar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        {ALL_TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap rounded-lg transition-all',
                active ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* CONTEÚDO */}
      <div>
        {tab === 'geral' && (
          <AbaVisaoGeral
            client={client}
            platformData={platformData}
          />
        )}
        {tab === 'engajamento' && engajamentoData && (
          <AbaEngajamento data={engajamentoData} />
        )}
        {tab === 'performance' && <AbaPerformance orgId={id!} />}
        {tab === 'acessos' && <AdminAcessoCliente orgId={id} />}
      </div>
    </div>
  );
}
