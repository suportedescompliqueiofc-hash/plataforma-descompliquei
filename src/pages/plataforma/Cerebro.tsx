import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Stethoscope, Briefcase,
  HelpCircle, GraduationCap, Plus, Trash2, Save, Loader2, CheckCircle2,
  BrainCircuit, ChevronLeft, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { getMaterialPreviewText } from "@/utils/materialFormatting";
// Simple local debounce implementation since lodash is not installed
function debounce(func: Function, wait: number) {
  let timeout: any;
  const debounced = function(...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
  debounced.flush = () => {
    if (timeout) {
      clearTimeout(timeout);
      func();
    }
  };
  debounced.pending = () => !!timeout;
  return debounced;
}

type Phase = 1 | 2 | 3 | 4 | 5;

type Procedure = { id: string; name: string; category: string; ticket: string; volume: string; potential: string };
type FAQ = { id: string; question: string; answer: string; category: string };
type Objection = { id: string; objection: string; answer: string; frequency: string };
type Material = { id: string; title: string; module_id: string; content: string; type: string };

const PHASES = [
  { id: 1 as Phase, icon: Building2, name: 'Identidade', desc: 'Quem você é e o que você representa' },
  { id: 2 as Phase, icon: Stethoscope, name: 'Procedimentos', desc: 'O que você oferece e como precifica' },
  { id: 3 as Phase, icon: Briefcase, name: 'Operação', desc: 'Como funciona o comercial da sua clínica hoje' },
  { id: 4 as Phase, icon: HelpCircle, name: 'FAQ & Objeções', desc: 'O que os pacientes sempre perguntam' },
  { id: 5 as Phase, icon: GraduationCap, name: 'Trilha de Aprendizado', desc: 'Adicione ao Cérebro o que você construiu na Trilha' },
];

export default function Cerebro() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activePhase, setActivePhase] = useState<Phase>(1);
  const [materials, setMaterials] = useState<Material[]>([]);
  
  // Use a ref to store the latest formData for the debounced saver to access without closure issues
  const formDataRef = useRef<any>(null);

  // Default initial state
  const initialFormState = {
    // Fase 1 — Identidade
    clinic_name: '', profissional_nome: '', specialty_principal: '', especialidades_complementares: [],
    cidade: '', estado: '', city_state: '', ano_fundacao: '', tamanho_equipe: '', descricao_profissional: '',
    proposito_clinica: '', limites_valores: '',
    // Fase 2 — Procedimentos
    anchor_procedure: '', anchor_why: '', anchor_resultado: '', anchor_ticket_atual: '', anchor_ticket_desejado: '',
    procedures: [] as Procedure[], posicionamento_preco: '', frequencia_desconto: '', objecao_preco_principal: '',
    // Fase 3 — Operação (campos que NÃO vêm da Trilha)
    working_hours: '', payment_methods: '', maior_falha_comercial: '',
    // Fase 4 — FAQ & Objeções
    faq: [] as FAQ[], objecoes_banco: [] as Objection[],
    // Fase 5 — Trilha de Aprendizado
    materiais_adicionados: [] as string[]
  };

  const [formData, setFormData] = useState<any>(initialFormState);
  const activePhaseData = PHASES.find(p => p.id === activePhase) || PHASES[0];

  // Sync ref with state
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Carregamento — banco sempre tem prioridade sobre o localStorage
  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);

        // Buscar dados do banco (fonte de verdade)
        const [cerebroResult, profileResult, matsResult] = await Promise.all([
          supabase.from('platform_cerebro').select('*').eq('user_id', user.id).maybeSingle(),
          supabase.from('platform_users').select('clinic_name, specialty').eq('id', user.id).maybeSingle(),
          supabase.from('platform_materiais').select('*').eq('user_id', user.id)
        ]);

        if (cerebroResult.error) throw cerebroResult.error;
        if (matsResult.data) setMaterials(matsResult.data);

        const cerebro = cerebroResult.data;
        const userProfile = profileResult.data;

        if (cerebro) {
          // Começa com o estado inicial e sobrescreve com dados reais do banco
          const mappedData: any = { ...initialFormState };

          // Mapeia cada coluna do banco para o estado do formulário
          Object.keys(mappedData).forEach(key => {
            // Apenas sobrescreve se o valor do banco não for null/undefined
            // Strings vazias do banco SÃO consideradas válidas (usuário limpou o campo)
            if (cerebro[key] !== undefined && cerebro[key] !== null) {
              mappedData[key] = cerebro[key];
            }
          });

          // Campos que vivem em platform_users (não em platform_cerebro)
          mappedData.clinic_name = userProfile?.clinic_name || '';
          // specialty_principal: usa specialty_preset do banco ou o specialty do perfil
          mappedData.specialty_principal = cerebro.specialty_preset || userProfile?.specialty || mappedData.specialty_principal || '';

          // Garantir que arrays sejam sempre arrays (dados legados podem ter null)
          const arrayFields = ['procedures', 'faq', 'objecoes_banco', 'materiais_adicionados', 'especialidades_complementares'];
          arrayFields.forEach(f => {
            if (!Array.isArray(mappedData[f])) mappedData[f] = [];
          });

          setFormData(mappedData);
          // Atualizar backup local com os dados reais do banco
          localStorage.setItem(`cerebro_backup_${user.id}`, JSON.stringify(mappedData));
        } else {
          // Nenhum registro no banco ainda — tentar restaurar do localStorage
          const localBackup = localStorage.getItem(`cerebro_backup_${user.id}`);
          if (localBackup) {
            try {
              const parsed = JSON.parse(localBackup);
              parsed.clinic_name = userProfile?.clinic_name || parsed.clinic_name || '';
              setFormData(parsed);
            } catch {}
          } else {
            // Estado limpo com nome da clínica do perfil
            setFormData((prev: any) => ({ ...prev, clinic_name: userProfile?.clinic_name || '' }));
          }
        }
      } catch (err) {
        console.error("Error loading Cerebro:", err);
        // Em caso de erro, tentar o localStorage como fallback
        const localBackup = localStorage.getItem(`cerebro_backup_${user.id}`);
        if (localBackup) {
          try { setFormData(JSON.parse(localBackup)); } catch {}
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const saveToDb = async (dataToSave: any) => {
    if (!user) return;
    setSaveStatus('saving');
    
    // Lista de colunas reais na tabela platform_cerebro para evitar erro 400
    // NOTA: clinic_name e specialty_principal NÃO existem em platform_cerebro — ficam em platform_users
    // Colunas gerenciadas pelo Cérebro Central (exclui campos que vêm da Trilha de Aprendizado)
    // Campos da Trilha (ICP, Posicionamento, Métricas) são salvos via persistCerebroSync no Modulo.tsx
    const validColumns = [
      'user_id', 'profissional_nome', 'especialidades_complementares', 'cidade', 'estado',
      'city_state', 'specialty_preset', 'ano_fundacao', 'tamanho_equipe', 'descricao_profissional',
      'proposito_clinica', 'limites_valores', 'anchor_procedure', 'anchor_why',
      'anchor_resultado', 'anchor_ticket_atual', 'anchor_ticket_desejado',
      'procedures', 'posicionamento_preco', 'frequencia_desconto', 'objecao_preco_principal',
      'working_hours', 'payment_methods', 'maior_falha_comercial',
      'faq', 'objecoes_banco', 'materiais_adicionados', 'updated_at'
    ];

    // Colunas com tipo numérico no banco — precisam ser null quando vazias, nunca string ""
    const numericColumns = [
      'ano_fundacao', 'anchor_ticket_atual', 'anchor_ticket_desejado'
    ];

    const payload: any = {};
    validColumns.forEach(col => {
      if (dataToSave[col] !== undefined) {
        const val = dataToSave[col];
        if (numericColumns.includes(col)) {
          // Converte string vazia ou NaN para null para não quebrar o banco
          const num = Number(val);
          payload[col] = (val === '' || val === null || val === undefined || isNaN(num)) ? null : num;
        } else {
          payload[col] = val;
        }
      }
    });

    // Mapear campos do formulário para colunas do banco com nomes diferentes
    payload.specialty_preset = dataToSave.specialty_principal || null;

    payload.user_id = user.id;
    payload.updated_at = new Date().toISOString();

    try {
      const { error } = await supabase.from('platform_cerebro').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      
      // Sync de nome da clínica e especialidade no perfil
      await supabase.from('platform_users').update({ 
        clinic_name: dataToSave.clinic_name || undefined, 
        specialty: dataToSave.specialty_principal || undefined,
        cerebro_complete: true
      }).eq('id', user.id);

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      
      // Atualiza backup local após salvar com sucesso
      localStorage.setItem(`cerebro_backup_${user.id}`, JSON.stringify(dataToSave));
    } catch (e) {
      console.error("Error saving Cerebro:", e);
      setSaveStatus('idle');
    }
  };

  // Debounced save
  const debouncedSave = useCallback(
    debounce(() => {
      if (formDataRef.current) {
        saveToDb(formDataRef.current);
      }
    }, 3000),
    [user]
  );

  // Force save on unmount if pending
  useEffect(() => {
    return () => {
      if (debouncedSave.pending()) {
        debouncedSave.flush();
      }
    };
  }, [debouncedSave]);

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => {
      const newData = { ...prev, [field]: value };
      debouncedSave();
      return newData;
    });
  };

  const handleManualSave = async () => {
    await saveToDb(formData);
    toast.success('Cérebro Central salvo com sucesso!');
  };

  const toggleArrayValue = (field: string, value: string) => {
    const current = Array.isArray(formData[field]) ? formData[field] : [];
    const isSelected = current.includes(value);
    const newValue = isSelected ? current.filter((v:any) => v !== value) : [...current, value];
    updateField(field, newValue);
  };

  const completeness = useMemo(() => {
    const essentialFields = [
      'clinic_name', 'profissional_nome', 'specialty_principal', 'cidade', 'proposito_clinica',
      'anchor_procedure', 'posicionamento_preco',
      'working_hours', 'maior_falha_comercial'
    ];
    let filled = 0;
    essentialFields.forEach(f => {
      if (formData[f] && formData[f].toString().trim() !== '') filled++;
    });

    // Checks for lists
    if (formData.procedures?.length > 0) filled++;
    if (formData.faq?.length > 0) filled++;
    if (formData.objecoes_banco?.length > 0) filled++;

    const total = essentialFields.length + 3;
    return Math.round((filled / total) * 100);
  }, [formData]);

  const getBadgeInfo = () => {
    if (completeness <= 30) return { label: 'Básico', color: 'bg-muted text-muted-foreground' };
    if (completeness <= 60) return { label: 'Intermediário', color: 'bg-blue-500/20 text-blue-500' };
    if (completeness <= 85) return { label: 'Avançado', color: 'bg-amber-500/20 text-amber-500' };
    return { label: 'Completo', color: 'bg-emerald-500/20 text-emerald-500' };
  };

  const badgeInfo = getBadgeInfo();

  if (loading && !formData.clinic_name) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#E85D24] mb-4" />
        <p className="text-muted-foreground">Carregando sua memória estratégica...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 pb-28">
      {/* HEADER */}
      <div className="space-y-1 border-b border-border pb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">
              Cérebro Central
            </h1>
            <p className="text-muted-foreground text-[15px] mt-1">A memória estratégica da sua clínica — quanto mais você preenche, mais inteligentes ficam suas IAs.</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">{badgeInfo.label}</span>
                <span className="text-[11px] font-bold tabular-nums text-foreground font-mono">{completeness}%</span>
              </div>
              <div className="w-40 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-foreground rounded-full transition-all duration-500" style={{ width: `${completeness}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* HORIZONTAL NAV */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 pb-0 border-b border-border" data-tutorial="cerebro-nav">
        {PHASES.map((phase, index) => {
          const isActive = activePhase === phase.id;
          return (
            <button
              key={phase.id}
              onClick={() => setActivePhase(PHASES[index].id)}
              className={`relative flex-shrink-0 flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${isActive ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                {phase.id}
              </span>
              <span className="hidden sm:inline">{phase.name}</span>
              {isActive && <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-foreground rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* CONTENT BY PHASE */}
      <div className="min-h-[500px]">
        {/* HEADER DA FASE COM SETAS DE NAVEGAÇÃO */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground font-display">
              {activePhaseData.name}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">{activePhaseData.desc}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActivePhase(PHASES[Math.max(0, activePhase - 2)].id)}
              disabled={activePhase === 1}
              className="h-7 w-7 flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-muted-foreground font-mono tabular-nums">{activePhase}/5</span>
            <button
              onClick={() => setActivePhase(PHASES[Math.min(PHASES.length - 1, activePhase)].id)}
              disabled={activePhase === 5}
              className="h-7 w-7 flex items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* FASE 1: IDENTIDADE */}
        {activePhase === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300" data-tutorial="cerebro-identidade">
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5" data-tutorial="cerebro-field-nome">
                  <label className="text-[13px] font-medium text-foreground">Nome da Clínica</label>
                  <Input value={formData.clinic_name} onChange={e => updateField('clinic_name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">Nome do Responsável</label>
                  <Input value={formData.profissional_nome} onChange={e => updateField('profissional_nome', e.target.value)} />
                </div>
                <div className="space-y-1.5" data-tutorial="cerebro-field-especialidade">
                  <label className="text-[13px] font-medium text-foreground">Especialidade Principal</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.specialty_principal} onChange={e => updateField('specialty_principal', e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="Odontologia">Odontologia</option>
                    <option value="HOF">HOF</option>
                    <option value="Cirurgia Plástica">Cirurgia Plástica</option>
                    <option value="Dermatologia">Dermatologia</option>
                    <option value="Estética Avançada">Estética Avançada</option>
                    <option value="Outra">Outra</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">Especialidades Complementares</label>
                  <Input placeholder="Ex: Ortodontia, Preenchimento, etc"
                    value={formData.especialidades_complementares?.join(', ') || ''}
                    onChange={e => updateField('especialidades_complementares', e.target.value.split(',').map(s=>s.trim()))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">Cidade</label>
                  <Input value={formData.cidade} onChange={e => updateField('cidade', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">Estado (UF)</label>
                  <Input value={formData.estado} onChange={e => updateField('estado', e.target.value)} maxLength={2} placeholder="Ex: SP" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">Ano de Fundação</label>
                  <Input type="number" value={formData.ano_fundacao} onChange={e => updateField('ano_fundacao', Number(e.target.value) || '')} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">Tamanho da Equipe</label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.tamanho_equipe} onChange={e => updateField('tamanho_equipe', e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="Solo">Solo</option>
                    <option value="2-3 pessoas">2-3 pessoas</option>
                    <option value="4-10 pessoas">4-10 pessoas</option>
                    <option value="10+">10+</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-border space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">Como você se descreve como profissional?</label>
                  <Textarea placeholder="Tom pessoal..." className="min-h-[80px]" value={formData.descricao_profissional} onChange={e => updateField('descricao_profissional', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">Qual é o propósito maior da sua clínica?</label>
                  <Textarea placeholder="Nossa missão é..." className="min-h-[80px]" value={formData.proposito_clinica} onChange={e => updateField('proposito_clinica', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">O que você NÃO aceita na sua clínica?</label>
                  <Textarea placeholder="Limites, valores inegociáveis..." className="min-h-[80px]" value={formData.limites_valores} onChange={e => updateField('limites_valores', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FASE 2: PROCEDIMENTOS */}
        {activePhase === 2 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-4">Procedimento Âncora</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">Qual procedimento você mais quer vender?</label>
                  <Input value={formData.anchor_procedure} onChange={e => updateField('anchor_procedure', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">Por que esse é o âncora?</label>
                  <Input value={formData.anchor_why} onChange={e => updateField('anchor_why', e.target.value)} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[13px] font-medium text-foreground">Qual o resultado visual/físico que ele gera?</label>
                  <Textarea className="min-h-[80px]" value={formData.anchor_resultado} onChange={e => updateField('anchor_resultado', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">Ticket Médio Atual (R$)</label>
                  <Input type="number" value={formData.anchor_ticket_atual} onChange={e => updateField('anchor_ticket_atual', Number(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground">Ticket que Deseja Cobrar (R$)</label>
                  <Input type="number" value={formData.anchor_ticket_desejado} onChange={e => updateField('anchor_ticket_desejado', Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Lista de Procedimentos</p>
                <Button onClick={() => updateField('procedures', [...formData.procedures, { id: Date.now().toString(), name: '', category: '', ticket: '', volume: '', potential: '' }])} variant="outline" size="sm" className="h-8 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar
                </Button>
              </div>
              <div className="p-5 space-y-3">
                {formData.procedures.map((proc: any) => (
                  <div key={proc.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-start border border-border p-4 rounded-xl relative group">
                    <Button variant="ghost" size="icon" onClick={() => updateField('procedures', formData.procedures.filter((p:any) => p.id !== proc.id))} className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <div className="md:col-span-2 space-y-1"><span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">Nome</span><Input placeholder="Toxina" value={proc.name} onChange={e => updateField('procedures', formData.procedures.map((p:any) => p.id === proc.id ? { ...p, name: e.target.value } : p))} /></div>
                    <div className="space-y-1"><span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">Categoria</span><Input placeholder="Injetável" value={proc.category} onChange={e => updateField('procedures', formData.procedures.map((p:any) => p.id === proc.id ? { ...p, category: e.target.value } : p))} /></div>
                    <div className="space-y-1"><span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">Ticket</span><Input placeholder="R$" value={proc.ticket} onChange={e => updateField('procedures', formData.procedures.map((p:any) => p.id === proc.id ? { ...p, ticket: e.target.value } : p))} /></div>
                    <div className="space-y-1"><span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">Vol. Mensal</span><Input placeholder="Qtd" value={proc.volume} onChange={e => updateField('procedures', formData.procedures.map((p:any) => p.id === proc.id ? { ...p, volume: e.target.value } : p))} /></div>
                    <div className="space-y-1 pr-6"><span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">Potencial</span><Input placeholder="Alto/Baixo" value={proc.potential} onChange={e => updateField('procedures', formData.procedures.map((p:any) => p.id === proc.id ? { ...p, potential: e.target.value } : p))} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
               <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-4">Posicionamento de Preço</p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-foreground">Como você se posiciona?</label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={formData.posicionamento_preco} onChange={e => updateField('posicionamento_preco', e.target.value)}>
                      <option value="">Selecione...</option>
                      <option value="Acessível">Acessível</option>
                      <option value="Intermediário">Intermediário</option>
                      <option value="Premium">Premium</option>
                      <option value="Ultra Premium">Ultra Premium</option>
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-foreground">Você dá desconto?</label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={formData.frequencia_desconto} onChange={e => updateField('frequencia_desconto', e.target.value)}>
                      <option value="">Selecione...</option>
                      <option value="Nunca">Nunca</option>
                      <option value="Raramente">Raramente</option>
                      <option value="Às vezes">Às vezes</option>
                      <option value="Com frequência">Com frequência</option>
                    </select>
                 </div>
                 <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[13px] font-medium text-foreground">Qual objeção de preço você mais recebe?</label>
                    <Textarea value={formData.objecao_preco_principal} onChange={e => updateField('objecao_preco_principal', e.target.value)} />
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* FASE 3: OPERAÇÃO COMERCIAL */}
        {activePhase === 3 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5"><label className="text-[13px] font-medium text-foreground">Horários de funcionamento</label><Input value={formData.working_hours} onChange={e => updateField('working_hours', e.target.value)} placeholder="Ex: Seg a Sex, 09h as 18h" /></div>
                <div className="space-y-1.5"><label className="text-[13px] font-medium text-foreground">Formas de Pagamento Aceitas</label><Input value={formData.payment_methods} onChange={e => updateField('payment_methods', e.target.value)} /></div>
                <div className="space-y-1.5 md:col-span-2"><label className="text-[13px] font-medium text-foreground">Qual é a maior falha do seu comercial hoje?</label><Textarea value={formData.maior_falha_comercial} onChange={e => updateField('maior_falha_comercial', e.target.value)} /></div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-muted/30 border border-border rounded-xl text-[13px] text-muted-foreground">
              <BrainCircuit className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
              <p>Dados como <strong className="text-foreground font-medium">ICP</strong>, <strong className="text-foreground font-medium">Posicionamento</strong>, <strong className="text-foreground font-medium">Diferencial Competitivo</strong> e <strong className="text-foreground font-medium">Métricas Comerciais</strong> são construídos durante a Trilha de Aprendizado e salvos automaticamente no Cérebro Central.</p>
            </div>
          </div>
        )}

        {/* FASE 4: FAQ E OBJEÇÕES */}
        {activePhase === 4 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">FAQ Dinâmico</p>
                <Button onClick={() => updateField('faq', [...formData.faq, { id: Date.now().toString(), question: '', answer: '', category: '' }])} variant="outline" size="sm" className="h-8 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar Pergunta
                </Button>
              </div>
              <div className="p-5 space-y-3">
                {formData.faq.map((item: any) => (
                  <div key={item.id} className="grid grid-cols-1 gap-3 p-4 border border-border rounded-xl relative group">
                    <Button variant="ghost" size="icon" onClick={() => updateField('faq', formData.faq.filter((f:any) => f.id !== item.id))} className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <div className="space-y-1 w-full md:w-3/4"><span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">Pergunta</span><Input value={item.question} onChange={e => updateField('faq', formData.faq.map((f:any) => f.id === item.id ? { ...f, question: e.target.value } : f))} /></div>
                    <div className="space-y-1 w-full md:w-1/2"><span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">Categoria</span><Input placeholder="Sobre preço, resultado..." value={item.category} onChange={e => updateField('faq', formData.faq.map((f:any) => f.id === item.id ? { ...f, category: e.target.value } : f))} /></div>
                    <div className="space-y-1"><span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">Resposta Ideal</span><Textarea value={item.answer} onChange={e => updateField('faq', formData.faq.map((f:any) => f.id === item.id ? { ...f, answer: e.target.value } : f))} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Banco de Objeções</p>
                <Button onClick={() => updateField('objecoes_banco', [...formData.objecoes_banco, { id: Date.now().toString(), objection: '', answer: '', frequency: '' }])} variant="outline" size="sm" className="h-8 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar Objeção
                </Button>
              </div>
              <div className="p-5 space-y-3">
                {formData.objecoes_banco.map((item: any) => (
                  <div key={item.id} className="grid grid-cols-1 gap-3 p-4 border border-border rounded-xl relative group">
                    <Button variant="ghost" size="icon" onClick={() => updateField('objecoes_banco', formData.objecoes_banco.filter((o:any) => o.id !== item.id))} className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <div className="space-y-1 w-full md:w-3/4"><span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">Objeção</span><Input value={item.objection} onChange={e => updateField('objecoes_banco', formData.objecoes_banco.map((o:any) => o.id === item.id ? { ...o, objection: e.target.value } : o))} /></div>
                    <div className="space-y-1 w-full md:w-1/2">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">Frequência</span>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={item.frequency} onChange={e => updateField('objecoes_banco', formData.objecoes_banco.map((o:any) => o.id === item.id ? { ...o, frequency: e.target.value } : o))}>
                        <option value="">Selecione...</option><option value="Muito comum">Muito comum</option><option value="Comum">Comum</option><option value="Rara">Rara</option>
                      </select>
                    </div>
                    <div className="space-y-1"><span className="text-[10px] text-muted-foreground uppercase tracking-[0.06em] font-semibold">Resposta de Alta Conversão</span><Textarea value={item.answer} onChange={e => updateField('objecoes_banco', formData.objecoes_banco.map((o:any) => o.id === item.id ? { ...o, answer: e.target.value } : o))} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FASE 5: MATERIAIS DA TRILHA */}
        {activePhase === 5 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <GraduationCap className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground font-display">Enriqueça o Cérebro com seus materiais da Trilha</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5">Selecione os materiais que quer incluir como contexto para as IAs. <span className="font-medium text-foreground">{formData.materiais_adicionados?.length || 0}</span> materiais adicionados.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {materials.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-xl">
                  <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center mb-3">
                    <GraduationCap className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">Você ainda não tem materiais gerados na Trilha.</p>
                  <Button onClick={() => navigate('/plataforma/trilha')} variant="outline" size="sm" className="h-8 text-xs">Ir para Trilha</Button>
                </div>
              ) : (
                materials.map(mat => {
                  const isAdded = formData.materiais_adicionados?.includes(mat.id);
                  return (
                    <div key={mat.id} className={`rounded-xl border p-5 transition-all ${isAdded ? 'border-emerald-200 bg-emerald-50/50' : 'border-border bg-card shadow-card'}`}>
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-foreground line-clamp-1">{mat.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Módulo {mat.module_id}</p>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3 mb-4 leading-relaxed">{getMaterialPreviewText(mat.content, 200)}</p>
                      <Button
                        onClick={() => toggleArrayValue('materiais_adicionados', mat.id)}
                        variant="outline"
                        size="sm"
                        className={`w-full h-8 text-xs ${isAdded ? 'border-emerald-300 text-emerald-600 hover:bg-emerald-50' : 'border-border text-foreground hover:bg-muted/50'}`}
                      >
                        {isAdded ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Adicionado</> : <><Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar ao Cérebro</>}
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER FIXED */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-3 border-t border-border bg-background z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-muted-foreground">{completeness}% preenchido</span>
          {saveStatus === 'saving' && <span className="text-muted-foreground text-[11px] flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Salvando...</span>}
          {saveStatus === 'saved' && <span className="text-emerald-600 text-[11px] flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Salvo</span>}
        </div>
        <Button
          onClick={handleManualSave}
          disabled={saveStatus === 'saving'}
          className="bg-[#E85D24] hover:bg-[#D04E1A] text-white font-semibold h-9 px-5 text-sm"
        >
          {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
