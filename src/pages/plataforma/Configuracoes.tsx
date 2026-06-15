import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, User, Shield, CreditCard, Save, LogOut, Upload, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PasswordChangeCard from "@/components/settings/PasswordChangeCard";
import { useJornada, getJornadaProgress } from "@/hooks/useJornada";

export default function Configuracoes() {
  const { user } = useAuth();
  const { plataformaUser, plan } = usePlataforma();
  const { data: jornada } = useJornada();
  const progressPercent = jornada ? getJornadaProgress(jornada).pct : 0;

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  // Profile
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cityState, setCityState] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Prefs
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        setFullName(user.user_metadata?.full_name || "");
        
        if (plataformaUser) {
          setClinicName(plataformaUser.clinic_name || "");
          setSpecialty(plataformaUser.specialty || "");
          setWhatsapp(plataformaUser.whatsapp || "");
          setCityState(plataformaUser.city_state || "");
          setAvatarUrl(plataformaUser.avatar_url || "");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    
    // Lê tema do localStorage (chave unificada 'theme')
    const savedTheme = localStorage.getItem("theme") || localStorage.getItem("vite-ui-theme") || "light";
    setTheme(savedTheme);
    // Aplica imediatamente
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(savedTheme);
  }, [user, plataformaUser]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      // Auth metadata
      const { error: authErr } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });
      if (authErr) throw authErr;

      // Platform User data
      const { error: dbErr } = await supabase
        .from("platform_users")
        .update({
          clinic_name: clinicName,
          specialty: specialty,
          whatsapp: whatsapp,
          city_state: cityState
        })
        .eq("id", user.id);
      if (dbErr) throw dbErr;

      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar perfil: " + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGlobalSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      toast.success("Desconectado de todos os dispositivos.");
    } catch (err: any) {
      toast.error("Erro ao desconectar: " + err.message);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setAvatarUrl(data.publicUrl);
      
      await supabase.from('platform_users').update({ avatar_url: data.publicUrl }).eq('id', user.id);
      toast.success('Foto de perfil atualizada!');
    } catch (error: any) {
      toast.error('Erro ao fazer upload da foto: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[860px] mx-auto space-y-8 pb-20">
      {/* HEADER */}
      <div className="space-y-1 border-b border-border pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Configurações</h1>
        <p className="text-muted-foreground text-[15px]">Gerencie suas informações, preferências e segurança.</p>
      </div>

      <div className="space-y-8">

        {/* SEÇÃO 1 — PERFIL */}
        <section className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <User className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground font-display">Perfil da Conta</p>
              <p className="text-[12px] text-muted-foreground">Informações pessoais e públicas da clínica.</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-5">
              <Avatar className="w-16 h-16 border border-border">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="text-lg font-semibold bg-muted text-foreground">{fullName?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <label htmlFor="avatar-upload" className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                  <Upload className="w-3.5 h-3.5" /> Alterar foto
                </label>
                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <p className="text-[11px] text-muted-foreground mt-1.5">JPG, PNG ou GIF. Máximo 2MB.</p>
              </div>
            </div>

            {/* Form grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Nome completo</label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Email de acesso</label>
                <Input value={user?.email || ""} disabled className="bg-muted/40 border-border text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Nome da Clínica</label>
                <Input value={clinicName} onChange={e => setClinicName(e.target.value)} className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Especialidade</label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={specialty} onChange={e => setSpecialty(e.target.value)}
                >
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
                <label className="text-[13px] font-medium text-foreground">WhatsApp de contato</label>
                <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" className="bg-background border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground">Cidade / UF</label>
                <Input value={cityState} onChange={e => setCityState(e.target.value)} placeholder="Ex: São Paulo, SP" className="bg-background border-border" />
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end pt-2 border-t border-border">
              <Button onClick={handleSaveProfile} disabled={savingProfile} className="bg-[#E85D24] hover:bg-[#D04E1A] text-white font-semibold h-10 px-6 text-sm">
                {savingProfile ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Salvar Perfil
              </Button>
            </div>
          </div>
        </section>

        {/* SEÇÃO 2 — PREFERÊNCIAS */}
        <section className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Sun className="h-4 w-4 text-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground font-display">Preferências</p>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-foreground">Tema da Interface</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">Escolha entre modo claro ou escuro</p>
              </div>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <button
                  onClick={() => {
                    setTheme('light');
                    localStorage.setItem("theme", "light");
                    localStorage.setItem("vite-ui-theme", "light");
                    document.documentElement.classList.remove("light", "dark");
                    document.documentElement.classList.add("light");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${theme === 'light' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Sun className="w-3.5 h-3.5" /> Claro
                </button>
                <button
                  onClick={() => {
                    setTheme('dark');
                    localStorage.setItem("theme", "dark");
                    localStorage.setItem("vite-ui-theme", "dark");
                    document.documentElement.classList.remove("light", "dark");
                    document.documentElement.classList.add("dark");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Moon className="w-3.5 h-3.5" /> Escuro
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SEÇÃO 3 — SEGURANÇA */}
        <PasswordChangeCard />

        <section className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Shield className="h-4 w-4 text-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground font-display">Sessões e Acesso</p>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-foreground">Encerrar todas as sessões</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">Desconecta sua conta de todos os dispositivos.</p>
              </div>
              <Button onClick={handleGlobalSignOut} variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 h-9 text-xs font-medium whitespace-nowrap">
                <LogOut className="w-3.5 h-3.5 mr-2" /> Sair de todos os dispositivos
              </Button>
            </div>

            <div className="border-t border-border pt-4 flex flex-wrap gap-x-8 gap-y-2 text-[12px] text-muted-foreground">
              <div><span className="font-medium text-foreground">Membro desde:</span> {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'N/A'}</div>
              <div><span className="font-medium text-foreground">Último acesso:</span> {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : 'N/A'}</div>
            </div>
          </div>
        </section>

        {/* SEÇÃO 4 — ASSINATURA */}
        <section className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <CreditCard className="h-4 w-4 text-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground font-display">Minha Assinatura</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="rounded-lg bg-muted/30 border border-border p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">Plano Atual</p>
                <p className="text-base font-bold text-foreground font-display">{plan === 'gca' ? 'Gestão Comercial Avançada' : 'Profissional'}</p>
                <p className="text-[11px] text-muted-foreground font-mono mt-1">{plan?.toUpperCase()}</p>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <p className="text-base font-bold text-foreground font-display">Ativo</p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/30 border border-border p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">Progresso na Jornada</p>
                <p className="text-base font-bold text-foreground font-display">{progressPercent}%</p>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-foreground rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-border">
              <p className="text-[13px] text-muted-foreground">Para alterações no plano ou suporte, entre em contato com a Descompliquei.</p>
              <Button onClick={() => window.open('https://wa.me/5521959359594', '_blank')} variant="outline" size="sm" className="h-9 text-xs font-medium border-border whitespace-nowrap">
                Falar com suporte
              </Button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
