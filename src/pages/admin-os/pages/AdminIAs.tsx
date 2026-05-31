import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Zap, Play, Edit3, Loader2, History, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const MODEL_OPTIONS = [
  { group: 'xAI (Grok)', items: [
    { value: 'grok-4-1-fast-reasoning', label: 'Grok 4.1 Fast Reasoning' },
    { value: 'grok-4-1-fast-non-reasoning', label: 'Grok 4.1 Fast' },
    { value: 'grok-3', label: 'Grok 3' },
    { value: 'grok-3-mini', label: 'Grok 3 Mini' },
  ]},
  { group: 'OpenAI', items: [
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
  ]},
  { group: 'OpenRouter', items: [
    { value: 'openrouter/anthropic/claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { value: 'openrouter/anthropic/claude-sonnet-4-6-20250514', label: 'Claude Sonnet 4.6' },
    { value: 'openrouter/google/gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash' },
    { value: 'openrouter/deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
    { value: 'openrouter/meta-llama/llama-4-scout', label: 'Llama 4 Scout' },
    { value: 'openrouter/x-ai/grok-4-1-fast', label: 'Grok 4.1 Fast (via OR)' },
  ]},
];

interface IAConfig {
  id: string;
  name: string;
  description: string;
  model: string;
  system_prompt: string;
  min_plan: string;
  active: boolean;
}

interface IAHistory {
  id: string;
  user_id: string;
  ia_id: string;
  prompt: string;
  created_at: string;
  platform_users?: { clinic_name: string };
}

export default function AdminIAs() {
  const [loading, setLoading] = useState(true);
  const [ias, setIas] = useState<IAConfig[]>([]);
  const [history, setHistory] = useState<IAHistory[]>([]);

  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState<IAConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);

  const [showTest, setShowTest] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    document.title = 'IAs · Admin OS | Descompliquei';
    loadData();
  }, []);

  async function loadData() {
    try {
      const [iasRes, histRes] = await Promise.all([
        supabase.from('platform_ia_config').select('*').order('id'),
        supabase.from('platform_ia_history').select(`id, ia_id, prompt, created_at, platform_users(clinic_name)`).order('created_at', { ascending: false }).limit(50),
      ]);
      setIas(iasRes.data as IAConfig[] || []);
      setHistory(histRes.data as any[] || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: string, currentActive: boolean) {
    try {
      const { error } = await supabase.from('platform_ia_config').update({ active: !currentActive }).eq('id', id);
      if (error) throw error;
      setIas(prev => prev.map(ia => ia.id === id ? { ...ia, active: !currentActive } : ia));
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function saveIA() {
    if (!editData) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('platform_ia_config').update({
        name: editData.name, description: editData.description,
        model: editData.model, system_prompt: editData.system_prompt
      }).eq('id', editData.id);
      if (error) throw error;
      setIas(prev => prev.map(ia => ia.id === editData.id ? editData : ia));
      setShowEdit(false);
      toast.success('IA atualizada com sucesso!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function testIA() {
    if (!testInput || !editData) return;
    setTesting(true);
    setTestOutput('');
    try {
      const { data, error } = await supabase.functions.invoke('chat-completion', {
        body: { messages: [{ role: 'system', content: editData.system_prompt }, { role: 'user', content: testInput }], model: editData.model }
      });
      if (error) throw error;
      setTestOutput(data.choices?.[0]?.message?.content || 'Sem resposta');
    } catch (err: any) {
      setTestOutput(`Erro: ${err.message}`);
    } finally {
      setTesting(false);
    }
  }

  const hojeCount = history.filter(h => new Date(h.created_at).toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-muted">
            <Zap className="h-4 w-4 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Stack de IA Comercial</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">Configure prompts e modelos para as IAs da plataforma</p>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Consultas Hoje', value: hojeCount },
          { label: 'Consultas (últimas 50)', value: history.length },
          { label: 'Total de IAs', value: ias.length },
        ].map(m => (
          <div key={m.label} className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{m.label}</p>
            <p className="text-3xl font-black tabular-nums font-display text-foreground">{m.value}</p>
          </div>
        ))}
      </div>

      {/* TABELA DE IAs */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Inteligências Artificiais</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{ias.length} IAs configuradas</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                {['Codinome', 'Nome Exibido', 'Modelo', 'Status', 'Ações'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : ias.map(ia => (
                <tr key={ia.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="text-[11px] font-mono font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/40">{ia.id}</span>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-foreground text-[13px]">{ia.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border/40">
                      {ia.model?.startsWith('openrouter/') ? ia.model.split('/').pop() : ia.model}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Switch checked={ia.active} onCheckedChange={() => toggleActive(ia.id, ia.active)} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px] gap-1.5 border-border/60"
                        onClick={() => { setEditData(ia); setShowTest(true); }}>
                        <Play className="h-3 w-3" /> Testar
                      </Button>
                      <Button size="sm" className="h-7 rounded-lg text-[11px] gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                        onClick={() => { setEditData(ia); setShowEdit(true); }}>
                        <Edit3 className="h-3 w-3" /> Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* HISTÓRICO */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Últimas 50 Consultas</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Histórico recente de uso das IAs</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                {['Data', 'Cliente', 'IA', 'Input'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {history.map(h => (
                <tr key={h.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 text-[11px] text-muted-foreground tabular-nums">{format(new Date(h.created_at), 'dd/MM/yy HH:mm')}</td>
                  <td className="px-5 py-3 font-medium text-[13px] text-foreground">{(h as any).platform_users?.clinic_name || 'Desconhecido'}</td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] font-mono font-bold bg-muted/60 px-2 py-0.5 rounded-md border border-border/40 text-muted-foreground">{h.ia_id}</span>
                  </td>
                  <td className="px-5 py-3 text-[11px] text-muted-foreground/70 truncate max-w-[280px]">
                    {h.prompt.length > 60 ? h.prompt.substring(0, 60) + '...' : h.prompt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDITAR */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display">Editar IA: {editData?.id}</DialogTitle>
          </DialogHeader>
          {editData && (
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome Exibido</label>
                  <Input className="h-10 rounded-lg border-border/60" value={editData.name || ''} onChange={e => setEditData({...editData, name: e.target.value})} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição</label>
                  <Input className="h-10 rounded-lg border-border/60" value={editData.description || ''} onChange={e => setEditData({...editData, description: e.target.value})} />
                </div>
                <div className="space-y-1.5 col-span-2 relative">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Modelo LLM</label>
                  <Input
                    className="h-10 rounded-lg border-border/60"
                    value={editData.model || ''}
                    onChange={e => setEditData({...editData, model: e.target.value})}
                    onFocus={() => setShowModelSuggestions(true)}
                    placeholder="Digite ou selecione um modelo..."
                  />
                  {showModelSuggestions && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border/60 rounded-xl shadow-lg max-h-[280px] overflow-y-auto">
                      {MODEL_OPTIONS.map(group => (
                        <div key={group.group}>
                          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 bg-muted/40 sticky top-0">{group.group}</p>
                          {group.items
                            .filter(item => !editData.model || item.value.toLowerCase().includes(editData.model.toLowerCase()) || item.label.toLowerCase().includes(editData.model.toLowerCase()))
                            .map(item => (
                              <button key={item.value} type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex justify-between items-center"
                                onClick={() => { setEditData({...editData, model: item.value}); setShowModelSuggestions(false); }}>
                                <span>{item.label}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{item.value.length > 28 ? '...' + item.value.slice(-22) : item.value}</span>
                              </button>
                            ))}
                        </div>
                      ))}
                      <button type="button" className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60 border-t border-border/40"
                        onClick={() => setShowModelSuggestions(false)}>Fechar sugestões</button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex justify-between">
                    <span>System Prompt</span>
                    <span className="text-muted-foreground/50 normal-case font-normal">{editData.system_prompt.length} caracteres</span>
                  </label>
                  <Textarea className="min-h-[400px] font-mono text-sm rounded-lg border-border/60" value={editData.system_prompt} onChange={e => setEditData({...editData, system_prompt: e.target.value})} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="h-9 rounded-lg text-xs" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button onClick={saveIA} disabled={saving} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5">
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />} Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL TESTAR */}
      <Dialog open={showTest} onOpenChange={setShowTest}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Testar IA: {editData?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Input de Teste</label>
              <Textarea className="rounded-lg border-border/60" rows={4} placeholder="O que deseja perguntar para a IA?" value={testInput} onChange={e => setTestInput(e.target.value)} />
            </div>
            <Button onClick={testIA} disabled={testing || !testInput}
              className="w-full h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90">
              {testing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-2 h-3.5 w-3.5" />} Gerar resposta de teste
            </Button>
            {testOutput && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resposta</label>
                <div className="bg-muted/40 p-4 rounded-xl text-sm whitespace-pre-wrap font-mono border border-border/60 max-h-[300px] overflow-y-auto">
                  {testOutput}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
