import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ExternalLink, BrainCircuit, BookOpen, Bot, FolderOpen, TrendingUp, FileText, Clock, Activity, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

import AbaVisaoGeral from './cliente/AbaVisaoGeral';
import AbaProgresso from './cliente/AbaProgresso';
import AbaIAs from './cliente/AbaIAs';
import AbaAnotacoes from './cliente/AbaAnotacoes';
import AbaHealthScore from './cliente/AbaHealthScore';
import AdminAcessoCliente from './AdminAcessoCliente';

type Tab = 'geral' | 'progresso' | 'cerebro' | 'ias' | 'materiais' | 'health' | 'anotacoes' | 'historico' | 'acessos';

interface ProductAccess {
  acesso_crm: boolean;
  acesso_cerebro: boolean;
  acesso_sessoes_taticas: boolean;
  acesso_materiais: boolean;
  acesso_ia_comercial: boolean;
  pilares_liberados: string[];
  ias_liberadas: string[];
}

const ALL_TABS: { id: Tab; label: string; icon: any; needsAccess?: keyof ProductAccess | 'pilares' }[] = [
  { id: 'geral', label: 'Visão Geral', icon: Activity },
  { id: 'progresso', label: 'Progresso', icon: BookOpen, needsAccess: 'pilares' },
  { id: 'cerebro', label: 'Cérebro', icon: BrainCircuit, needsAccess: 'acesso_cerebro' },
  { id: 'ias', label: 'IAs', icon: Bot, needsAccess: 'acesso_ia_comercial' },
  { id: 'materiais', label: 'Materiais', icon: FolderOpen, needsAccess: 'acesso_materiais' },
  { id: 'health', label: 'Health Score', icon: TrendingUp },
  { id: 'anotacoes', label: 'Anotações', icon: FileText },
  { id: 'historico', label: 'Histórico', icon: Clock },
  { id: 'acessos', label: 'Acessos', icon: KeyRound },
];

function timeAgo(d: string): string {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

const IA_LABEL: Record<string, string> = {
  preattendance: 'Pré-Atendimento', objections: 'Objeções',
  remarketing: 'Remarketing', analysis: 'Análise',
  copywriter: 'Copywriter', scripts: 'Scripts',
};

const CEREBRO_FIELDS: { key: string; label: string; fase: number; format?: (c:any, u:any) => string }[] = [
  { key: 'clinic_name', label: 'Nome da Clínica', fase: 1, format: (c, u) => u?.clinic_name },
  { key: 'profissional_nome', label: 'Nome do Profissional', fase: 1 },
  { key: 'specialty_preset', label: 'Especialidade', fase: 1 },
  { key: 'cidade', label: 'Cidade', fase: 1, format: (c, u) => c?.cidade ? `${c.cidade}${c.estado ? ` - ${c.estado}` : ''}` : '' },
  { key: 'proposito_clinica', label: 'Propósito', fase: 1 },
  { key: 'anchor_procedure', label: 'Procedimento Âncora', fase: 2 },
  { key: 'posicionamento_preco', label: 'Posicionamento de Preço', fase: 2 },
  { key: 'icp_faixa_etaria', label: 'Faixa Etária ICP', fase: 3 },
  { key: 'icp_maior_dor', label: 'Maior Dor do ICP', fase: 3 },
  { key: 'icp_maior_desejo', label: 'Maior Desejo', fase: 3 },
  { key: 'diferencial_exclusivo', label: 'Diferencial Exclusivo', fase: 4 },
  { key: 'voice_tone', label: 'Tom de Voz', fase: 4 },
  { key: 'working_hours', label: 'Horário de Atendimento', fase: 5 },
  { key: 'maior_falha_comercial', label: 'Maior Falha Comercial', fase: 5 },
  { key: 'faq', label: 'FAQ', fase: 6, format: c => c?.faq?.length ? `${c.faq.length} pergunta(s) adicionada(s)` : '' },
  { key: 'objecoes_banco', label: 'Objeções', fase: 6, format: c => c?.objecoes_banco?.length ? `${c.objecoes_banco.length} objeção(ões) adicionada(s)` : '' },
  { key: 'materiais_adicionados', label: 'Materiais de Referência', fase: 7, format: c => c?.materiais_adicionados?.length ? `${c.materiais_adicionados.length} material(is) adicionado(s)` : '' },
];

export default function AdminClientePerfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('geral');
  const [loading, setLoading] = useState(true);

  const [client, setClient] = useState<any>(null);
  const [progressData, setProgressData] = useState<any[]>([]);
  const [progressDetails, setProgressDetails] = useState<any[]>([]);
  const [iaHistory, setIaHistory] = useState<any[]>([]);
  const [cerebro, setCerebro] = useState<any>(null);
  const [materiais, setMateriais] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [healthHistory, setHealthHistory] = useState<any[]>([]);
  const [totalModulesCount, setTotalModulesCount] = useState(0);
  const [productAccess, setProductAccess] = useState<ProductAccess | null>(null);

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    try {
      // id é organization_id — resolver para platform_users.id via perfis
      // Buscar IDs de superadmin para excluir da seleção de perfil
      const { data: superadminRoles } = await supabase
        .from('usuarios_papeis')
        .select('usuario_id')
        .eq('papel', 'superadmin');
      const superadminIds = new Set((superadminRoles ?? []).map((r: any) => r.usuario_id));

      const { data: perfisOrg } = await supabase
        .from('perfis')
        .select('id, nome_completo, email')
        .eq('organization_id', id);
      const perfil = perfisOrg?.find(p => !superadminIds.has(p.id))
        ?? perfisOrg?.[0] ?? null;

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

      // Se não tem platform_user, monta dados básicos do perfil
      if (!puData && perfil) {
        puData = { email: perfil.email, nome_completo: perfil.nome_completo };
      }

      // Buscar dados do tenant (produto, status, expiração)
      const { data: tenant } = await supabase
        .from('platform_tenants')
        .select('product_id, status, trial_ends_at')
        .eq('organization_id', id)
        .maybeSingle();

      let product_name: string | null = null;
      let access: ProductAccess = {
        acesso_crm: true, acesso_cerebro: false, acesso_sessoes_taticas: false,
        acesso_materiais: false, acesso_ia_comercial: false,
        pilares_liberados: [], ias_liberadas: [],
      };

      if (tenant?.product_id) {
        const { data: prod } = await supabase
          .from('platform_products')
          .select('nome, acesso_crm, acesso_cerebro, acesso_sessoes_taticas, acesso_materiais, acesso_ia_comercial, pilares_liberados, ias_liberadas')
          .eq('id', tenant.product_id)
          .maybeSingle();
        product_name = prod?.nome ?? null;
        if (prod) {
          access = {
            acesso_crm: prod.acesso_crm ?? true,
            acesso_cerebro: prod.acesso_cerebro ?? false,
            acesso_sessoes_taticas: prod.acesso_sessoes_taticas ?? false,
            acesso_materiais: prod.acesso_materiais ?? false,
            acesso_ia_comercial: prod.acesso_ia_comercial ?? false,
            pilares_liberados: prod.pilares_liberados ?? [],
            ias_liberadas: prod.ias_liberadas ?? [],
          };
        }
      }

      setProductAccess(access);

      setClient(puData ? {
        ...puData,
        product_name,
        tenant_status: tenant?.status ?? null,
        trial_ends_at: tenant?.trial_ends_at ?? null,
      } : null);

      if (puId) {
        // Sempre carrega notas e health (são ferramentas admin)
        const adminQueries = [
          supabase.from('admin_client_notes').select('*').eq('client_id', puId).order('created_at', { ascending: false }),
          supabase.from('admin_client_health').select('*').eq('client_id', puId).order('created_at', { ascending: false }),
        ];
        const [notesRes, healthRes] = await Promise.all(adminQueries);
        setNotes(notesRes.data || []);
        setHealthHistory(healthRes.data || []);

        // Carrega dados de plataforma somente se o produto dá acesso
        const hasPlatform = access.pilares_liberados.length > 0 || access.acesso_cerebro || access.acesso_ia_comercial || access.acesso_materiais;
        if (hasPlatform) {
          const platformQueries = await Promise.all([
            access.pilares_liberados.length > 0 ? supabase.from('platform_progress').select('*').eq('user_id', puId) : { data: [] },
            access.pilares_liberados.length > 0 ? supabase.from('platform_module_progress_detail').select('*').eq('user_id', puId) : { data: [] },
            access.pilares_liberados.length > 0 ? supabase.from('platform_modules').select('id', { count: 'exact', head: true }).eq('active', true) : { count: 0 },
            access.acesso_ia_comercial ? supabase.from('platform_ia_history').select('*').eq('user_id', puId).order('created_at', { ascending: false }) : { data: [] },
            access.acesso_cerebro ? supabase.from('platform_cerebro').select('*').eq('user_id', puId).single() : { data: null },
            access.acesso_materiais ? supabase.from('platform_materiais').select('*').eq('user_id', puId).order('created_at', { ascending: false }) : { data: [] },
          ]);
          setProgressData((platformQueries[0] as any).data || []);
          setProgressDetails((platformQueries[1] as any).data || []);
          setTotalModulesCount((platformQueries[2] as any).count || 0);
          setIaHistory((platformQueries[3] as any).data || []);
          setCerebro((platformQueries[4] as any).data);
          setMateriais((platformQueries[5] as any).data || []);
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [id]);

  // Computed
  const modulosConcluidos = new Set(
    progressDetails
      .filter(item => item.step === 'finalize' && item.completed === true)
      .map(item => item.module_id)
  ).size;
  const modulosIniciados = new Set(progressDetails.map(item => item.module_id)).size;
  const totalModulos = totalModulesCount;
  const progress = totalModulos > 0 ? Math.round((modulosConcluidos / totalModulos) * 100) : 0;

  const recentActivity = [
    ...progressData.filter(p => p.completed && p.completed_at).map(p => ({
      tipo: 'modulo', descricao: `Concluiu o módulo ${p.module_id}`, date: p.completed_at,
    })),
    ...iaHistory.slice(0, 5).map(h => ({
      tipo: 'ia', descricao: `Usou a IA de ${IA_LABEL[h.ia_type] || h.ia_type}`, date: h.created_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  const hasTrilha = (productAccess?.pilares_liberados?.length ?? 0) > 0;
  const visibleTabs = ALL_TABS.filter(t => {
    if (!t.needsAccess) return true;
    if (t.needsAccess === 'pilares') return hasTrilha;
    return productAccess?.[t.needsAccess] ?? false;
  });

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-7 w-7 animate-spin text-[#E85D24]" />
    </div>
  );

  if (!client) return (
    <div className="text-center py-20">
      <p className="text-muted-foreground">Cliente não encontrado.</p>
      <Button variant="link" onClick={() => navigate('/admin/clientes')}>← Voltar</Button>
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
          <div className="p-6">
            <div className="flex flex-wrap items-start gap-4">
              {/* Avatar */}
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                <span className="text-xl font-black text-foreground/60">{(client.clinic_name || client.nome_completo || 'C').charAt(0)}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground font-display">{client.clinic_name || client.nome_completo || 'Sem nome'}</h1>
                  {client.product_name && (
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-muted text-muted-foreground border-border/60">
                      {client.product_name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{client.email || '—'}</p>
                {hasTrilha && (
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center gap-2 flex-1 max-w-44">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-foreground/40 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs font-bold text-foreground tabular-nums font-mono">{progress}%</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{modulosConcluidos} de {totalModulos} módulos</span>
                    <span className="text-[11px] text-muted-foreground/60">{modulosIniciados} iniciado(s)</span>
                  </div>
                )}
              </div>

              {/* Ações rápidas */}
              <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs gap-1.5 border-border/60 shrink-0"
                onClick={() => window.open(`/plataforma`, '_blank')}>
                <ExternalLink className="h-3.5 w-3.5" /> Ver Plataforma
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 bg-muted/40 rounded-xl p-1 w-fit max-w-full">
        {visibleTabs.map(t => {
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

      {/* CONTEÚDO DAS ABAS */}
      <div>
        {tab === 'geral' && (
          <AbaVisaoGeral client={client} progress={progress} modulosConcluidos={modulosConcluidos}
            iaTotal={iaHistory.length} materiaisTotal={materiais.length} recentActivity={recentActivity} productAccess={productAccess} />
        )}

        {tab === 'progresso' && <AbaProgresso clientId={id!} progressData={progressData} progressDetails={progressDetails} />}

        {tab === 'cerebro' && (
          <div className="space-y-3">
            {!cerebro ? (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-border/60 bg-card">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <BrainCircuit className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhum dado no Cérebro Central</p>
              </div>
            ) : (
              [1, 2, 3, 4, 5, 6, 7].map(fase => {
                const fields = CEREBRO_FIELDS.filter(f => f.fase === fase);
                const filled = fields.filter(f => {
                  const val = f.format ? f.format(cerebro, client) : cerebro[f.key];
                  return val && String(val).trim();
                }).length;
                const pct = fields.length > 0 ? Math.round((filled / fields.length) * 100) : 0;
                return (
                  <div key={fase} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Fase {fase}</p>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-foreground/40 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold tabular-nums font-mono text-foreground">{pct}%</span>
                      </div>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fields.map(f => {
                        const val = f.format ? f.format(cerebro, client) : cerebro[f.key];
                        return (
                          <div key={f.key}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">{f.label}</p>
                            <p className="text-sm text-foreground line-clamp-2">{val || <span className="text-muted-foreground/30 italic">Não preenchido</span>}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'ias' && <AbaIAs iaHistory={iaHistory} />}

        {tab === 'materiais' && (
          <div className="space-y-3">
            {materiais.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-border/60 bg-card">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhum material gerado ainda</p>
              </div>
            ) : materiais.map(m => (
              <div key={m.id} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{m.title}</p>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/40">Módulo {m.module_id}</span>
                    {m.category && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/40">{m.category}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{m.content}</p>
                </div>
                <span className="text-[11px] text-muted-foreground/60 shrink-0 tabular-nums">{new Date(m.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'health' && (
          <AbaHealthScore clientId={id!} healthHistory={healthHistory} onRefresh={loadAll} />
        )}

        {tab === 'anotacoes' && (
          <AbaAnotacoes clientId={id!} notes={notes} onRefresh={loadAll} />
        )}

        {tab === 'acessos' && (
          <AdminAcessoCliente orgId={id} />
        )}

        {tab === 'historico' && (
          <div className="space-y-2">
            {[
              ...progressData.filter(p => p.completed && p.completed_at).map(p => ({ tipo: 'modulo', desc: `Concluiu módulo ${p.module_id}`, date: p.completed_at })),
              ...iaHistory.map(h => ({ tipo: 'ia', desc: `Usou IA de ${IA_LABEL[h.ia_type] || h.ia_type}`, date: h.created_at })),
              ...materiais.map(m => ({ tipo: 'material', desc: `Material gerado: ${m.title}`, date: m.created_at })),
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 px-4 rounded-lg hover:bg-muted/30 transition-colors">
                <div className={`h-2 w-2 rounded-full shrink-0 ${item.tipo === 'ia' ? 'bg-purple-500' : item.tipo === 'material' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                <p className="text-sm text-foreground flex-1">{item.desc}</p>
                <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(item.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
