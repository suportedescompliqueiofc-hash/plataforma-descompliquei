import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Bot, Target, PlayCircle, Zap, ShieldCheck, CheckCircle2, ChevronRight, BrainCircuit } from "lucide-react";
import { toast } from "sonner"; // fallback import for sonner

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plataformaUser, plan, tenant } = usePlataforma();
  const [productName, setProductName] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProductName() {
      const productId = tenant?.product_id;
      if (!productId) return;
      const { data } = await supabase
        .from('platform_products')
        .select('nome')
        .eq('id', productId)
        .maybeSingle();
      if (data?.nome) setProductName(data.nome);
    }
    fetchProductName();
  }, [tenant]);

  const [step, setStep] = useState(1);
  const totalSteps = 4;
  const [loading, setLoading] = useState(false);

  // Step 2 Form
  const [clinicName, setClinicName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // Step 3 Pre-sets
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const presets = [
    { id: 'HOF', title: 'Harmonização Facial (HOF)', desc: 'Preenchimento, Botox, Fios de Sustentação.' },
    { id: 'Odonto', title: 'Odontologia Premium', desc: 'Invisalign, Lentes de Contato Dental, Implantes.' },
    { id: 'Estetica', title: 'Medicina Estética', desc: 'Emagrecimento, Tratamentos a Laser, Soroterapia.' },
    { id: 'Plastica', title: 'Cirurgia Plástica', desc: 'Lipo HD, Prótese de Mama, Rinoplastia.' },
    { id: 'Zero', title: 'Começar do Zero', desc: 'Preencher manualmente todas as características da clínica.' },
  ];

  useEffect(() => {
    if (plataformaUser) {
      if (plataformaUser.clinic_name) setClinicName(plataformaUser.clinic_name);
      if (plataformaUser.specialty) setSpecialty(plataformaUser.specialty);
      if (plataformaUser.onboarding_complete) {
        navigate('/plataforma');
      }
    }
  }, [plataformaUser, navigate]);

  const handleNextStep = async () => {
    if (step === 2) {
      // Validate Step 2
      if (!clinicName || !specialty) {
        toast("Preencha Nome e Especialidade.");
        return;
      }
      setLoading(true);
      await supabase.from('platform_users').update({
        clinic_name: clinicName,
        specialty,
      }).eq('id', user?.id);
      setLoading(false);
    }

    if (step === 3) {
      if (!selectedPreset) {
        toast("Escolha um direcional para seu Cérebro Central.");
        return;
      }
      setLoading(true);
      
      // Update platform cerebro preset
      const { data: cerebro } = await supabase.from('platform_cerebro').select('id').eq('user_id', user?.id).maybeSingle();
      if (cerebro) {
         await supabase.from('platform_cerebro').update({ specialty: selectedPreset, whatsapp }).eq('id', cerebro.id);
      } else {
         await supabase.from('platform_cerebro').insert({ user_id: user?.id, specialty: selectedPreset, whatsapp });
      }
      setLoading(false);
    }

    if (step === 4) {
       await finishOnboarding();
       return;
    }

    setStep(s => s + 1);
  };

  const finishOnboarding = async () => {
    setLoading(true);
    await supabase.from('platform_users').update({ onboarding_complete: true }).eq('id', user?.id);
    toast("Configuração concluída! Bem-vindo(a) ao Hub!");
    
    // Forçar recarregamento do contexto para não barrar na rota
    setTimeout(() => {
      window.location.href = '/plataforma';
    }, 1000);
  };

  const planBadge = productName
    ? <Badge className="bg-[#E85D24] text-white pointer-events-none mt-2">{productName}</Badge>
    : plan === 'gca'
      ? <Badge className="bg-[#E85D24] text-white pointer-events-none mt-2">Plano G.C.A. Ativo</Badge>
      : <Badge className="bg-muted text-foreground pointer-events-none mt-2 text-muted-foreground border-border">Plano P.C.A. Básico</Badge>;

  function Badge({ children, className }: any) {
    return <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${className}`}>{children}</span>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* ProgressBar */}
      <div className="w-full max-w-2xl mb-8 space-y-2">
        <div className="flex justify-between text-xs font-bold text-muted-foreground font-mono">
          <span>SETUP INICIAL</span>
          <span>PASSO {step} DE {totalSteps}</span>
        </div>
        <div className="flex h-1 gap-1">
          {[1,2,3,4].map(i => (
             <div key={i} className={`h-full flex-1 rounded-full transition-colors duration-500 ${step >= i ? 'bg-[#E85D24]' : 'bg-muted'}`} />
          ))}
        </div>
      </div>

      <Card className="w-full max-w-2xl border-border shadow-xl relative overflow-hidden bg-card">
        {/* Accent line — subtle, single-color */}
        <div className="absolute top-0 w-full h-[2px] bg-[#E85D24]" />
        
        <CardContent className="p-8 md:p-12">
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
              <div className="w-16 h-16 rounded-2xl bg-[#E85D24]/10 text-[#E85D24] flex items-center justify-center mb-6">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground leading-tight tracking-tight font-display">Bem-vindo(a) ao Hub<br/>de Gestão Comercial</h1>
              <div className="text-muted-foreground text-lg leading-relaxed">
                Você acaba de dar o passo mais importante para estruturar a previsibilidade de vendas e atendimento da sua clínica.
              </div>
              
              <div className="p-4 border border-border rounded-xl bg-background mt-4 pointer-events-none select-none">
                <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-1 block">Nível de Acesso</span>
                {planBadge}
              </div>

              <Button size="lg" className="w-full bg-[#E85D24] hover:bg-[#E85D24]/90 text-white font-bold h-12 mt-8 tracking-wide text-md" onClick={handleNextStep}>
                Começar Configuração <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
              <h2 className="text-xl font-semibold text-foreground tracking-tight">O Motor da sua Clínica</h2>
              <p className="text-muted-foreground text-sm">Precisamos entender qual é a nave que você pilota para personalizarmos os frameworks.</p>
              
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-foreground">Nome Oficial da Clínica/Consultório *</Label>
                  <Input className="h-12 bg-background border-border text-foreground" placeholder="Ex: Clínica Descompliquei HOF" value={clinicName} onChange={e=>setClinicName(e.target.value)} />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-foreground">Especialidade Principal *</Label>
                  <select 
                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-[#E85D24]"
                    value={specialty} onChange={e=>setSpecialty(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    <option value="Harmonização Facial">Harmonização Facial</option>
                    <option value="Odontologia">Odontologia (Geral/Estética)</option>
                    <option value="Dermatologia">Dermatologia</option>
                    <option value="Cirurgia Plástica">Cirurgia Plástica</option>
                    <option value="Nutrição/Emagrecimento">Nutrição / Emagrecimento</option>
                    <option value="Estética Avançada">Clínica de Estética Avançada</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-foreground">WhatsApp Comercial (Opcional)</Label>
                  <Input type="tel" className="h-12 bg-background border-border text-foreground" placeholder="Ex: (11) 99999-9999" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} />
                </div>
              </div>

              <Button disabled={loading || !clinicName || !specialty} size="lg" className="w-full bg-[#E85D24] text-white font-bold h-12 mt-8 tracking-wide" onClick={handleNextStep}>
                {loading ? 'Salvando...' : 'Avançar '} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
               <div className="flex items-center gap-3">
                 <BrainCircuit className="w-8 h-8 text-[#E85D24]" />
                 <div><h2 className="text-xl font-semibold text-foreground tracking-tight">Cérebro Central</h2>
                 <p className="text-muted-foreground text-sm">A sua IA precisa ser calibrada. Escolha seu nicho base.</p></div>
               </div>
               
               <div className="space-y-3 pt-2">
                 {presets.map(p => (
                   <div 
                     key={p.id} 
                     onClick={() => setSelectedPreset(p.id)}
                     className={`flex flex-col border rounded-xl p-4 cursor-pointer transition-all ${selectedPreset === p.id ? 'border-[#E85D24] bg-[#E85D24]/5 shadow-sm' : 'border-border bg-background hover:border-foreground/20 text-muted-foreground'}`}
                   >
                     <p className={`font-bold ${selectedPreset === p.id ? 'text-[#E85D24]' : 'text-foreground'}`}>{p.title}</p>
                     <p className="text-xs mt-1 leading-relaxed opacity-90">{p.desc}</p>
                   </div>
                 ))}
               </div>

               <Button disabled={loading || !selectedPreset} size="lg" className="w-full bg-[#E85D24] text-white font-bold h-12 mt-4 tracking-wide" onClick={handleNextStep}>
                {loading ? 'Processando Base...' : 'Alimentar Cérebro'} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
              <h2 className="text-xl font-semibold text-foreground tracking-tight">Seu Hub está Pronto!</h2>
              <p className="text-muted-foreground text-sm font-medium">Veja o seu arsenal de ferramentas abaixo:</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                 <div className="border border-border p-4 rounded-xl flex gap-4 items-start bg-card">
                   <PlayCircle className="w-6 h-6 text-emerald-500 mt-0.5 shrink-0" />
                   <div><p className="font-bold text-sm text-foreground mb-0.5">Trilha de Aprendizado</p><p className="text-xs text-muted-foreground">O mapa do GCA e PCA gravado e estruturado pra escala.</p></div>
                 </div>
                 <div className="border border-border p-4 rounded-xl flex gap-4 items-start bg-card">
                   <Target className="w-6 h-6 text-blue-500 mt-0.5 shrink-0" />
                   <div><p className="font-bold text-sm text-foreground mb-0.5">Sessões Táticas</p><p className="text-xs text-muted-foreground">Acompanhe as mentorias ao vivo ou assista o replay liberado.</p></div>
                 </div>
                 <div className="border border-border p-4 rounded-xl flex gap-4 items-start bg-card">
                   <Bot className="w-6 h-6 text-amber-500 mt-0.5 shrink-0" />
                   <div><p className="font-bold text-sm text-foreground mb-0.5">IAs Comerciais</p><p className="text-xs text-muted-foreground">Aceleradores de produtividade de tráfego e scripts 24/7.</p></div>
                 </div>
                 <div className="border border-border p-4 rounded-xl flex gap-4 items-start bg-card">
                   <Zap className="w-6 h-6 text-[#E85D24] mt-0.5 shrink-0" />
                   <div><p className="font-bold text-sm text-foreground mb-0.5">CRM (Esteira Mestra)</p><p className="text-xs text-muted-foreground">Ferramenta acoplada no hub pra tocar todos seus leads.</p></div>
                 </div>
              </div>

               <Button disabled={loading} size="lg" className="w-full bg-[#E85D24] text-white font-bold h-14 mt-8 tracking-widest uppercase text-sm shadow-xl hover:bg-[#E85D24]/90" onClick={handleNextStep}>
                {loading ? 'Redirecionando...' : 'Desbloquear Acesso à Plataforma'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
