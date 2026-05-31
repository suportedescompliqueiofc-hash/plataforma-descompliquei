import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Server, Database, Key, Activity, RefreshCw, Trash2, Settings, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TableCounts {
  users: number; progress: number; history: number; cerebro: number; materiais: number; modules: number;
}

interface IALog {
  id: string; created_at: string; user_id: string; ia_slug: string;
  input_data: string; output_text: string; platform_users?: { clinic_name: string };
}

export default function AdminSistema() {
  const [loading, setLoading] = useState(true);
  const [tableCounts, setTableCounts] = useState<TableCounts>({ users: 0, progress: 0, history: 0, cerebro: 0, materiais: 0, modules: 0 });
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; msg: string }>({ status: 'idle', msg: '' });
  const [configs, setConfigs] = useState({ platform_name: '', support_whatsapp: '', support_email: '', welcome_message: '', xai_model: 'grok-3-mini' });
  const [savingConfig, setSavingConfig] = useState(false);
  const [iaLogs, setIaLogs] = useState<IALog[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState<'cache' | 'reindex' | null>(null);

  useEffect(() => {
    document.title = 'Sistema · Admin OS | Descompliquei';
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const tables = ['platform_users', 'platform_progress', 'platform_ia_history', 'platform_cerebro', 'platform_materiais', 'platform_modules'];
      const counts: any = {};
      for (const table of tables) {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        counts[table.split('_')[1] || table] = count || 0;
      }
      setTableCounts({ users: counts['users'] || 0, progress: counts['progress'] || 0, history: counts['ia'] || counts['history'] || 0, cerebro: counts['cerebro'] || 0, materiais: counts['materiais'] || 0, modules: counts['modules'] || 0 });

      const { data: cfgData } = await supabase.from('admin_system_config').select('key, value');
      if (cfgData) {
        const newCfg = { ...configs };
        cfgData.forEach(c => { if (c.key in newCfg) (newCfg as any)[c.key] = c.value; });
        setConfigs(newCfg);
      }

      const { data: logsData } = await supabase
        .from('platform_ia_history').select(`*, platform_users(clinic_name)`)
        .or('output_text.ilike.%error%,output_text.is.null')
        .order('created_at', { ascending: false }).limit(20);
      if (logsData) setIaLogs(logsData);
    } catch (err: any) {
      if (err.name !== 'AbortError') toast.error('Falha ao carregar dados do sistema.');
    } finally {
      setLoading(false);
    }
  }

  async function saveConfigs() {
    setSavingConfig(true);
    try {
      const updates = Object.entries(configs).map(([key, value]) => ({ key, value }));
      const { error } = await supabase.from('admin_system_config').upsert(updates, { onConflict: 'key' });
      if (error) throw error;
      toast.success('Configurações atualizadas com sucesso!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function testXAI() {
    setTestResult({ status: 'loading', msg: 'Testando...' });
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('ia-proxy', {
        body: { messages: [{ role: 'user', content: 'Say OK' }], model: configs.xai_model }
      });
      if (error) throw error;
      setTestResult({ status: 'ok', msg: `Conexão OK · resposta em ${Date.now() - start}ms` });
    } catch (err: any) {
      setTestResult({ status: 'error', msg: `Erro: ${err.message}` });
    }
  }

  async function clearOldLogs() {
    if (!confirm('Excluir logs de erro com mais de 30 dias?')) return;
    try {
      const { error } = await supabase.from('platform_ia_history').delete()
        .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .or('output_text.ilike.%error%,output_text.is.null');
      if (error) throw error;
      toast.success('Logs antigos limpos.');
      loadAll();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleMaintenance(action: 'cache' | 'reindex') {
    if (action === 'cache' && !confirm('Forçar recarregamento invalida o cache atual dos módulos. Confirmar?')) return;
    if (action === 'reindex' && !confirm('Reindexar progresso vai recalcular o GCA/PCA de todos os clientes. Confirmar?')) return;
    setMaintenanceLoading(action);
    try {
      await new Promise(r => setTimeout(r, 1500));
      toast.success(action === 'cache' ? 'Cache de módulos invalidado.' : 'Progresso reindexado com sucesso.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMaintenanceLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-muted">
            <Settings className="h-4 w-4 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Sistema & Configurações</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">Status técnico e configurações gerais da plataforma</p>
      </div>

      {/* STATUS DO SISTEMA */}
      <section className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Status do Sistema</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Conexão xAI */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted"><Server className="h-3.5 w-3.5 text-muted-foreground" /></span>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Conexão xAI</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${testResult.status === 'ok' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : testResult.status === 'error' ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-muted text-muted-foreground border-border/40'}`}>
                  {testResult.status === 'ok' ? 'Conectada' : testResult.status === 'error' ? 'Erro' : 'Aguardando'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Modelo</span>
                <span className="text-xs font-mono text-muted-foreground">{configs.xai_model}</span>
              </div>
              <Button variant="outline" size="sm" className="w-full h-8 rounded-lg text-xs border-border/60 gap-1.5" onClick={testXAI} disabled={testResult.status === 'loading'}>
                {testResult.status === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Testar Conexão
              </Button>
              {testResult.msg && (
                <p className={`text-[11px] text-center ${testResult.status === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>{testResult.msg}</p>
              )}
            </div>
          </div>

          {/* Supabase */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted"><Database className="h-3.5 w-3.5 text-muted-foreground" /></span>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Supabase</p>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Conectado</span>
              </div>
              <div className="space-y-1.5">
                {[
                  { label: 'Usuários', value: tableCounts.users },
                  { label: 'Progresso', value: tableCounts.progress },
                  { label: 'Histórico IA', value: tableCounts.history },
                  { label: 'Módulos', value: tableCounts.modules },
                  { label: 'Materiais', value: tableCounts.materiais },
                  { label: 'Cérebro', value: tableCounts.cerebro },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-mono tabular-nums text-foreground font-bold">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Variáveis de ambiente */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted"><Key className="h-3.5 w-3.5 text-muted-foreground" /></span>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Variáveis de Ambiente</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'VITE_SUPABASE_URL', ok: !!import.meta.env.VITE_SUPABASE_URL },
                { label: 'VITE_SUPABASE_ANON_KEY', ok: !!import.meta.env.VITE_SUPABASE_ANON_KEY },
              ].map(v => (
                <div key={v.label} className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground truncate">{v.label}</span>
                  {v.ok
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    : <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CONFIGURAÇÕES GERAIS */}
      <section className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Configurações Gerais</p>
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome da Plataforma</label>
                <Input className="h-10 rounded-lg border-border/60 text-sm" value={configs.platform_name} onChange={e => setConfigs({...configs, platform_name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Modelo xAI Padrão</label>
                <Select value={configs.xai_model} onValueChange={v => setConfigs({...configs, xai_model: v})}>
                  <SelectTrigger className="h-10 rounded-lg border-border/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grok-4-1-fast-reasoning">grok-4-1-fast-reasoning</SelectItem>
                    <SelectItem value="grok-3-mini">grok-3-mini</SelectItem>
                    <SelectItem value="grok-3">grok-3</SelectItem>
                    <SelectItem value="grok-2">grok-2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp de Suporte</label>
                <Input className="h-10 rounded-lg border-border/60 text-sm" value={configs.support_whatsapp} onChange={e => setConfigs({...configs, support_whatsapp: e.target.value})} placeholder="5511999999999" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email de Suporte</label>
                <Input className="h-10 rounded-lg border-border/60 text-sm" type="email" value={configs.support_email} onChange={e => setConfigs({...configs, support_email: e.target.value})} placeholder="suporte@descompliquei.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mensagem de Boas-vindas</label>
              <Textarea className="rounded-lg border-border/60 text-sm" value={configs.welcome_message} onChange={e => setConfigs({...configs, welcome_message: e.target.value})} rows={3} />
            </div>
          </div>
          <div className="flex items-center justify-end px-6 py-4 border-t border-border/40 bg-muted/20">
            <Button onClick={saveConfigs} disabled={savingConfig} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5">
              {savingConfig ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
              Salvar Configurações
            </Button>
          </div>
        </div>
      </section>

      {/* LOGS DE ERRO */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Logs de Erro (IAs)</p>
          <Button variant="outline" size="sm" className="h-7 rounded-lg text-[11px] border-border/60 gap-1.5 text-muted-foreground hover:text-red-500" onClick={clearOldLogs}>
            <Trash2 className="h-3 w-3" /> Limpar &gt; 30 dias
          </Button>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  {['Data/Hora', 'Cliente', 'IA', 'Erro'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {iaLogs.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum log de erro encontrado.</td></tr>
                ) : iaLogs.map(log => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
                    <td className="px-5 py-3 font-medium text-[13px]">{log.platform_users?.clinic_name || 'Desconhecido'}</td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-mono bg-muted/60 px-2 py-0.5 rounded-md border border-border/40 text-muted-foreground">{log.ia_slug}</span>
                    </td>
                    <td className="px-5 py-3 text-[11px] text-red-500/80 max-w-[280px] truncate" title={log.output_text || 'Erro desconhecido'}>
                      {log.output_text || 'Sem resposta / Timeout'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* MANUTENÇÃO */}
      <section className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Manutenção</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { action: 'cache' as const, icon: RefreshCw, iconColor: 'text-blue-500', bg: 'bg-blue-500/10', title: 'Recarregar Módulos', desc: 'Invalida o cache e força a plataforma a buscar módulos atualizados do banco.' },
            { action: 'reindex' as const, icon: Database, iconColor: 'text-purple-500', bg: 'bg-purple-500/10', title: 'Reindexar Progresso', desc: 'Recalcula os totais de GCA e PCA de todos os clientes baseando-se no histórico.' },
          ].map(m => (
            <div key={m.action} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 flex flex-col items-center text-center gap-4">
              <div className={`p-3 rounded-xl ${m.bg}`}>
                <m.icon className={`h-6 w-6 ${m.iconColor}`} />
              </div>
              <div>
                <p className="font-bold text-foreground">{m.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
              </div>
              <Button variant="outline" className="w-full h-9 rounded-lg text-xs border-border/60" onClick={() => handleMaintenance(m.action)} disabled={maintenanceLoading !== null}>
                {maintenanceLoading === m.action ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : m.action === 'cache' ? 'Forçar Recarregamento' : 'Reindexar Agora'}
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
