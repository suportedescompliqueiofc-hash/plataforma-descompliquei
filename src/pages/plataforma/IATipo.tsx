import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Copy, History, Save, Maximize2, BrainCircuit, Zap } from "lucide-react";
import { toast } from "sonner"; // Using standard toast if sonner is available.
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormattedText } from "@/components/FormattedText";

export default function IATipo() {
  const { tipo } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cerebroData, acesso } = usePlataforma();

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [history, setHistory] = useState<{id: string, input_prompt: string, output_response: string, created_at: string}[]>([]);
  
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState("");
  
  // Dynamic fields
  const [fields, setFields] = useState<any>({});

  // Save Modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveCategory, setSaveCategory] = useState("Outros");

  // Expand Modal
  const [expandModalOpen, setExpandModalOpen] = useState(false);

  // IA Config Dictionary
  const CONFIG: Record<string, any> = {
    preattendance: {
      name: 'IA Pré-Atendimento', benefit: 'Evitar que leads esfriem por dúvidas comuns.',
      howTo: 'Preencha sobre o procedimento e a dúvida do paciente. A IA irá formular uma resposta acolhedora baseada no seu FAQ.',
      promptTemplate: 'Você é especialista em atendimento clínico. Clínica: {CLINIC_DIFFERENTIALS}. Tom de voz: {VOICE_TONE}. Procedimento: {procedimento}. Dúvida do lead: {duvida}. Gere uma resposta impecável para Whatsapp.',
      inputs: [{ id: 'procedimento', label: 'Procedimento / Serviço' }, { id: 'duvida', label: 'Dúvida do lead', type: 'textarea' }]
    },
    objections: {
      name: 'IA Objeções', benefit: 'Quebrar barreiras sem dar desconto ou pressionar.',
      howTo: 'Apenas cole a resposta do paciente (ex: Tá muito caro, vou pensar) que iremos contornar com sua autoridade.',
      promptTemplate: 'Você é especialista em vendas consultivas para clínicas de saúde.\nO profissional tem o seguinte perfil de clínica: {CLINIC_DIFFERENTIALS}.\nProcedimento âncora: {ANCHOR}.\nTom de voz: {VOICE_TONE}.\nO paciente disse a seguinte objeção: {input}\nGere uma resposta de alta conversão para Whatsapp sem dar desconto e sem pressionar, usando linguagem de autoridade.',
      inputs: [{ id: 'input', label: 'Cole a objeção que recebeu', type: 'textarea' }]
    },
    analysis: {
      name: 'IA Análise de Atendimento', benefit: 'Diagnosticar erros na venda.',
      howTo: 'Cole o roteiro da conversa crua do seu WhatsApp comercial. Nossas IAs vão apontar as rupturas.',
      promptTemplate: 'Você analisa atendimentos comerciais de clínicas de saúde.\nTom de voz ideal da clínica: {VOICE_TONE}.\nAnalise o atendimento abaixo e identifique:\n1) Os 3 pontos de ruptura,\n2) Em qual momento o lead esfriou,\n3) O que deveria ter sido dito diferente,\n4) Plano de melhoria para o próximo atendimento.\n\nAtendimento:\n{input}',
      inputs: [{ id: 'input', label: 'Cole o texto do atendimento', type: 'textarea' }]
    },
    followup: {
      name: 'IA Follow-Up', benefit: 'Reaquecer contatos que visualizaram e não responderam.',
      howTo: 'Descreva a etapa (D+1, etc), procedimento base e o contexto do lead.',
      promptTemplate: 'Gere uma mensagem de follow-up para WhatsApp de uma clínica de saúde.\nProcedimento: {procedimento}.\nEtapa: {etapa}.\nPerfil do lead: {perfil}.\nDiferenciais da Clínica: {CLINIC_DIFFERENTIALS}.\nA mensagem não pode parecer spam. Deve ser natural, conversacional, personalizada com tom {VOICE_TONE} e conduzir ao próximo passo sem ser óbvio.',
      inputs: [{ id: 'procedimento', label: 'Procedimento Negociado' }, { id: 'etapa', label: 'Etapa (Ex: Dia 1, Dia 3, etc.)' }, { id: 'perfil', label: 'Contexto / Perfil do Lead' }]
    },
    remarketing: {
      name: 'IA Remarketing', benefit: 'Fazer caixa rápido com pessoas da base.',
      howTo: 'Defina quão inativo está o lead e o procedimento alvo.',
      promptTemplate: 'Você deve criar um roteiro de abordagem de remarketing humanizado para ex-pacientes ou leads inativos.\nInatividade: {inatividade}.\nProcedimento ofertado: {procedimento}.\nPerfil/Público ICP: {perfil}.\nTom de voz: {VOICE_TONE}.\nAja de modo orgânico como se a clínica lembrasse com carinho deste perfil, oferecendo uma novidade sutil.',
      inputs: [{ id: 'inatividade', label: 'Tempo de Inatividade (Ex: 6 meses)' }, { id: 'procedimento', label: 'Procedimento / Novidade' }, { id: 'perfil', label: 'Como era esse ICP?' }]
    },
    campaign: {
      name: 'IA Briefing Campanhas', benefit: 'Criar direcionadores práticos de anúncios.',
      howTo: 'Preencha o que quer rodar no tráfego pago.',
      promptTemplate: 'Crie um briefing técnico de anúncios (Facebook/Instagram Ads) para uma clínica de saúde.\nProcedimento alvo: {procedimento}.\nObjetivo: {objetivo}.\nVerba de Guerra: {verba}.\nLeve em consideração o Perfil (ICP): {ICP_PROFILE}.\nGere 3 ideias de ângulos e configurações.',
      inputs: [{ id: 'procedimento', label: 'Procedimento alvo' }, { id: 'objetivo', label: 'Objetivo da Campanha' }, { id: 'verba', label: 'Verba Aproximada' }]
    },
    creative: {
      name: 'IA Roteirista Criativo', benefit: 'Gerar textos diretos pro Reel ou Foto.',
      howTo: 'Idealize qual procedimento quer focar para gravar conteúdo.',
      promptTemplate: 'Escreva um roteiro altamente retentor para um {formato} nas redes sociais da clínica.\nProcedimento em foco: {procedimento}.\nICP/Avatar: {ICP_PROFILE}.\nMedos que o ICP possui e devemos quebrar: {ICP_FEARS}.\nTraga Gancho (3s), Retenção, Corpo do Valor e um CTA invisível.',
      inputs: [{ id: 'procedimento', label: 'Procedimento Focado' }, { id: 'formato', label: 'Formato (ex: Reels falado, Carrossel, Storie)' }]
    },
    content: {
      name: 'IA Estratégia de Conteúdo', benefit: 'Calendário com linhas finas e persuasividade.',
      howTo: 'Deixe a IA montar seu funil orgânico (TOFU, MOFU, BOFU).',
      promptTemplate: 'Baseado no especialista clínico atuando focado em {procedimento}, gere uma pauta / grade de conteúdo para o período de {periodo}.\nDiferenciais da pessoa: {CLINIC_DIFFERENTIALS}.\nFaça mix de Prova, Educação, Quebra de Objeção e Entretenimento Técnico. Tom de voz {VOICE_TONE}.',
      inputs: [{ id: 'procedimento', label: 'Procedimentos Alvo do mix' }, { id: 'periodo', label: 'Período (Ex: 1 semana, 1 mês)' }]
    }
  };

  const iaConfig = CONFIG[tipo || ''] || CONFIG['objections'];
  const iasLiberadas = acesso.ias_liberadas ?? [];
  const iaLiberada = !tipo || iasLiberadas.includes(tipo);

  useEffect(() => {
    async function loadHistory() {
      if (!user || !tipo) return;
      const { data, error } = await supabase
        .from('platform_ia_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('ia_type', tipo)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        setHistory(data);
      }
      setLoadingHistory(false);
    }
    loadHistory();
    
    // Load persisted state for this specific IA
    if (user && tipo) {
      const storageKey = `ia_state_${user.id}_${tipo}`;
      try {
        const savedFields = localStorage.getItem(storageKey + '_fields');
        setFields(savedFields ? JSON.parse(savedFields) : {});
        
        const savedOutput = localStorage.getItem(storageKey + '_output');
        setOutput(savedOutput || "");
      } catch {
        setFields({});
        setOutput("");
      }
    }
  }, [tipo, user]);

  // Save state on change
  useEffect(() => {
    if (user && tipo && (Object.keys(fields).length > 0 || output)) {
      const storageKey = `ia_state_${user.id}_${tipo}`;
      localStorage.setItem(storageKey + '_fields', JSON.stringify(fields));
      localStorage.setItem(storageKey + '_output', output);
    } else if (user && tipo && Object.keys(fields).length === 0 && !output) {
      // Clear storage if user clicks "Nova Consulta"
      const storageKey = `ia_state_${user.id}_${tipo}`;
      localStorage.removeItem(storageKey + '_fields');
      localStorage.removeItem(storageKey + '_output');
    }
  }, [fields, output, tipo, user]);

  const replaceVariables = (template: string) => {
    let prompt = template;
    
    // Injete Cérebro
    prompt = prompt.replace(/{CLINIC_DIFFERENTIALS}/g, cerebroData?.differentials || 'Excelência e resultado em saúde.');
    prompt = prompt.replace(/{ANCHOR}/g, cerebroData?.anchor_procedure || 'Procedimento Ouro');
    prompt = prompt.replace(/{VOICE_TONE}/g, cerebroData?.voice_tone || 'Sério e Profissional');
    
    const icpAgeStr = cerebroData?.icp?.age ? `Idade: ${cerebroData.icp.age}` : '';
    const icpMotiv = cerebroData?.icp?.motivations ? `Desejos: ${cerebroData.icp.motivations}` : '';
    const icpFears = cerebroData?.icp?.fears || 'Dor, frustração ou preço';
    prompt = prompt.replace(/{ICP_PROFILE}/g, `${icpAgeStr} ${icpMotiv}`);
    prompt = prompt.replace(/{ICP_FEARS}/g, icpFears);

    // Injete Inputs do user
    iaConfig.inputs.forEach((inputDef: any) => {
      const regex = new RegExp(`{${inputDef.id}}`, 'g');
      prompt = prompt.replace(regex, fields[inputDef.id] || '(Não informado)');
    });

    return prompt;
  };

  const handleGenerate = async () => {
    // Basic validation
    const missing = iaConfig.inputs.find((i:any) => !fields[i.id]);
    if (missing) {
      toast.error(`O campo ${missing.label} é muito importante!`);
      return;
    }

    setGenerating(true);
    try {
      if (!user) throw new Error("Usuário não autenticado");

      // Invoca a nossa Edge Function do xAI Grok Proxy
      const { data, error } = await supabase.functions.invoke('ia-proxy', {
        body: {
           ia_type: tipo,
           input_data: fields,
           user_id: user.id
        }
      });
      
      if (error) {
        console.error('Erro na Edge Function:', error);
        if (error.message?.includes('401')) {
          throw new Error("Erro de Autenticação (401): A função ia-proxy pode estar sem permissão ou não foi deployada corretamente com CORS.");
        }
        throw new Error(error.message || "Erro ao chamar a IA");
      }
      
      if (data && data.text) {
         setOutput(data.text);
         
         // Atualiza o histórico local para mostrar imediatamente (já foi salvo real pela cloud function)
         const inputSummary = JSON.stringify(fields).substring(0, 50) + "...";
         const newHist = {
           id: Math.random().toString(), // fake ID para render local até o re-fetch
           user_id: user.id,
           ia_type: tipo || 'geral',
           input_prompt: inputSummary,
           output_response: data.text,
           created_at: new Date().toISOString()
         };
         setHistory(prev => [newHist, ...prev].slice(0, 5));
      } else {
         throw new Error("A IA não retornou nenhum texto.");
      }
    } catch (e: any) {
      console.error("Erro na Geração: ", e);
      toast.error("Houve um erro na geração: " + (e.message || "Tente novamente."));
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenSaveModal = () => {
       const initialTitle = typeof fields === 'object' && Object.values(fields).length > 0 
           ? String(Object.values(fields)[0]).substring(0, 30) 
           : "Material Gerado";
       setSaveTitle(`${iaConfig.name} - ${initialTitle}`);
       setSaveCategory("Outros");
       setSaveModalOpen(true);
  };

  const handleConfirmSaveMaterial = async () => {
    if (!output || !user || !saveTitle) return;
    try {
       const { error } = await supabase.from('platform_materiais').insert({
          user_id: user.id,
          title: saveTitle,
          category: saveCategory,
          type: 'Documento', // It can be 'Documento' since it's a general text output
          content: output,
          created_at: new Date().toISOString() // Assuming the schema has created_at
       });
       if (error) throw error;
       toast.success("Salvo com sucesso nos Meus Materiais!");
       setSaveModalOpen(false);
    } catch(err: any) {
       toast.error("Erro ao salvar: " + err.message);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
    toast("Copiado com sucesso! ✅");
  };

  const handleLoadHistory = (h: any) => {
    setOutput(h.output_response);
    toast("Membro do Histórico Carregado.");
  };

  // Guard: verificar se a IA está liberada no produto
  if (!iaLiberada) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-foreground">IA não disponível</h2>
        <p className="text-muted-foreground">Esta IA não está incluída no seu plano atual.</p>
        <Button variant="outline" onClick={() => navigate('/plataforma/ia-comercial')}>
          Voltar para IAs
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto min-h-[calc(100vh-100px)] pb-12 flex flex-col">
      {/* HEADER */}
      <div className="space-y-1 border-b border-border pb-6 mb-8">
        <button onClick={() => navigate('/plataforma/ia-comercial')} className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-3 tracking-[0.06em]">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para IAs Comerciais
        </button>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">{iaConfig.name}</h1>
        <p className="text-muted-foreground text-[15px]">{iaConfig.benefit}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        {/* COLUNA ESQUERDA - INSTRUÇÕES & HISTÓRICO */}
        <div className="w-full lg:w-[340px] shrink-0 space-y-5 lg:sticky lg:top-4 h-fit">
          {/* Instruções */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-card space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-2">Como usar</p>
              <p className="text-[13px] text-foreground/90 leading-relaxed">{iaConfig.howTo}</p>
            </div>
            {!cerebroData?.differentials && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <BrainCircuit className="h-3.5 w-3.5 text-foreground" />
                </div>
                <p className="text-[12px] text-muted-foreground leading-snug">Configure o <span className="font-medium text-foreground">Cérebro Central</span> para respostas personalizadas.</p>
              </div>
            )}
          </div>

          {/* Histórico */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-4 flex items-center gap-2">
              <History className="w-3.5 h-3.5" /> Histórico Recente
            </p>
            {loadingHistory ? (
              <div className="flex justify-center p-4"><Loader2 className="w-4 h-4 animate-spin opacity-40" /></div>
            ) : history.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-6 bg-muted/30 rounded-lg border border-dashed border-border">Nenhuma consulta realizada ainda.</p>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} onClick={() => handleLoadHistory(h)} className="border border-border bg-background p-3 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors group">
                    <p className="text-[10px] text-muted-foreground font-mono mb-1">{new Date(h.created_at).toLocaleString()}</p>
                    <p className="text-xs text-foreground font-medium line-clamp-2">{h.input_prompt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA - PROMPT E OUTPUT (65%) */}
        <div className="flex-1 flex flex-col space-y-6">
          
          {/* AREA INPUT */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-5">
             <div className="flex items-center gap-3 pb-4 border-b border-border">
               <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                 <Zap className="h-4 w-4 text-foreground" />
               </div>
               <div>
                 <p className="text-sm font-semibold text-foreground font-display">Contexto de Geração</p>
                 <p className="text-[12px] text-muted-foreground">Preencha os campos para personalizar a saída da IA.</p>
               </div>
             </div>

             <div className="space-y-5">
                {iaConfig.inputs.map((inp: any) => (
                  <div key={inp.id} className="space-y-1.5">
                    <label className="text-[13px] font-medium text-foreground">{inp.label}</label>
                    {inp.type === 'textarea' ? (
                      <Textarea
                        className="bg-background border-border min-h-[100px] text-sm resize-y"
                        value={fields[inp.id] || ''}
                        onChange={e => setFields({...fields, [inp.id]: e.target.value})}
                        placeholder={inp.label}
                      />
                    ) : (
                      <Input
                        className="bg-background border-border"
                        value={fields[inp.id] || ''}
                        onChange={e => setFields({...fields, [inp.id]: e.target.value})}
                        placeholder={inp.label}
                      />
                    )}
                  </div>
                ))}
             </div>

             <div className="pt-1 flex flex-col sm:flex-row gap-3 items-center border-t border-border pt-5">
               <Button
                 onClick={handleGenerate}
                 disabled={generating}
                 className="w-full sm:w-auto bg-[#E85D24] hover:bg-[#D04E1A] text-white font-semibold h-10 px-6 text-sm"
               >
                 {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</> : 'Gerar Resposta'}
               </Button>
               <Button variant="ghost" size="sm" onClick={() => {setFields({}); setOutput("");}} className="text-muted-foreground text-xs">Nova Consulta</Button>
             </div>
          </div>

          {/* AREA OUTPUT */}
          {output && (
            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden animate-in fade-in duration-300">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <p className="text-sm font-semibold text-foreground font-display">Resposta Gerada</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setExpandModalOpen(true)} className="h-8 text-xs border-border hover:bg-muted font-medium">
                    <Maximize2 className="w-3.5 h-3.5 mr-1.5" /> Expandir
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenSaveModal} className="h-8 text-xs border-border hover:bg-muted font-medium">
                    <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar
                  </Button>
                  <Button variant="outline" size="sm" onClick={copyToClipboard} className="h-8 text-xs border-border hover:bg-muted font-medium">
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                  </Button>
                </div>
              </div>
              <div className="p-6">
                <div className="bg-background border border-border rounded-lg p-5 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-border">
                  <FormattedText content={output} className="text-sm" />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground font-display">Salvar como Material</DialogTitle>
            <DialogDescription className="text-muted-foreground text-[13px]">
              Guarde este conteúdo em Meus Materiais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">Título do Material</label>
              <Input
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground">Categoria</label>
              <Select value={saveCategory} onValueChange={setSaveCategory}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  <SelectItem value="ICP">ICP / Persona</SelectItem>
                  <SelectItem value="Oferta">Oferta</SelectItem>
                  <SelectItem value="Script">Script de Venda</SelectItem>
                  <SelectItem value="Campanha">Campanha Ads</SelectItem>
                  <SelectItem value="Criativo">Conteúdo / Criativo</SelectItem>
                  <SelectItem value="Análise">Análise</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveModalOpen(false)} className="font-medium">Cancelar</Button>
            <Button onClick={handleConfirmSaveMaterial} className="bg-[#E85D24] hover:bg-[#D04E1A] text-white font-semibold">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expand Modal */}
      <Dialog open={expandModalOpen} onOpenChange={setExpandModalOpen}>
        <DialogContent className="sm:max-w-3xl h-[85vh] flex flex-col p-0 border-border overflow-hidden gap-0 bg-card">
          <DialogHeader className="p-6 border-b border-border shrink-0">
            <DialogTitle className="text-lg text-foreground font-bold font-display">{iaConfig.name} — Resposta</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border bg-background">
            <FormattedText content={output} className="text-sm" />
          </div>
          <div className="p-4 border-t border-border flex justify-end gap-3 shrink-0">
            <Button variant="outline" onClick={copyToClipboard} className="font-medium border-border">
              <Copy className="w-4 h-4 mr-2" /> Copiar Texto
            </Button>
            <Button onClick={() => setExpandModalOpen(false)} className="bg-[#E85D24] hover:bg-[#D04E1A] text-white font-semibold">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
