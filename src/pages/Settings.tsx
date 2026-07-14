import { useState, useEffect, useRef } from "react";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Save,
  Palette,
  Tag,
  Radio,
  Smartphone,
  Brush,
  Lock,
  Settings as SettingsIcon,
  Loader2,
  Mail,
  Users,
  Camera,
  LifeBuoy,
  Shield,
  LogOut,
  CreditCard,
  CalendarClock,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useClinicSettings } from "@/hooks/useClinicSettings";
import { usePlataforma } from "@/contexts/PlataformaContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ThemeSettings } from "@/components/settings/ThemeSettings";
import { TagSettings } from "@/components/settings/TagSettings";
import { SourceSettings } from "@/components/settings/SourceSettings";
import { BrandingSettings } from "@/components/settings/BrandingSettings";
import { WhatsAppSettings } from "@/components/settings/WhatsAppSettings";
import PasswordChangeCard from "@/components/settings/PasswordChangeCard";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { SuporteTab } from "@/components/settings/SuporteTab";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

// Alias simples — o campo de telefone usa o mesmo Input base
const PhoneInput = Input;

const ESPECIALIDADES = ["Odontologia", "HOF", "Cirurgia Plástica", "Dermatologia", "Estética Avançada", "Outra"];

export default function Settings() {
  // Lê seção da query string (?section=marca) para deep-link do onboarding
  const searchParams = new URLSearchParams(window.location.search);
  const initialSection = searchParams.get('section') || 'profile';
  const [activeSection, setActiveSection] = useState(initialSection);
  const { user } = useAuth();
  const { profile, role, isLoading: isLoadingProfile, updateProfile } = useProfile();
  const { isOwner } = usePermissions();
  const { settings, updateSettings } = useClinicSettings();
  const { plataformaUser, plan, tenant, diasRestantes, hasPlataformaAccess } = usePlataforma();

  // Tempo restante do produto — só existe para produtos com prazo definido (não CRM puro).
  // access_starts_at vem do tenant; se ausente (contratos antigos), reconstrói a partir da
  // duração do produto (trial_ends_at - duracao_dias).
  const duracaoDias: number | null = tenant?.duracao_dias ?? null;
  const contratoFim: Date | null = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const contratoInicio: Date | null = tenant?.access_starts_at
    ? new Date(tenant.access_starts_at)
    : (contratoFim && duracaoDias ? subDays(contratoFim, duracaoDias) : null);
  const mostrarPrazoContrato = hasPlataformaAccess && !!contratoFim && !!contratoInicio;
  const totalDiasContrato = mostrarPrazoContrato ? differenceInCalendarDays(contratoFim!, contratoInicio!) : 0;
  const diasDecorridos = mostrarPrazoContrato ? Math.min(totalDiasContrato, Math.max(0, totalDiasContrato - (diasRestantes ?? 0))) : 0;
  const pctContratoUsado = totalDiasContrato > 0 ? Math.min(100, Math.max(0, Math.round((diasDecorridos / totalDiasContrato) * 100))) : 0;
  const contratoVencido = mostrarPrazoContrato && (diasRestantes ?? 0) < 0;

  const [profileForm, setProfileForm] = useState({ nome_completo: '', specialty: '', whatsapp: '', city_state: '' });
  const [clinicForm, setClinicForm] = useState({ nome: '', cnpj: '', email: '', telefone: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingClinic, setIsSavingClinic] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}?t=${Date.now()}`;

    setIsUploadingAvatar(true);
    try {
      // Remove avatar anterior se existir
      await supabase.storage.from('avatars').remove([`${user.id}/avatar.${ext}`]);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(`${user.id}/avatar.${ext}`, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(`${user.id}/avatar.${ext}`);

      // Força cache bust na URL
      const urlWithBust = `${publicUrl}?t=${Date.now()}`;
      updateProfile({ url_avatar: urlWithBust }, { onSettled: () => setIsUploadingAvatar(false) });
    } catch (err: any) {
      setIsUploadingAvatar(false);
      console.error('[avatarUpload]', err?.message);
    }

    // Limpa o input para permitir reupload do mesmo arquivo
    e.target.value = '';
  };

  useEffect(() => {
    if (profile) {
      setProfileForm((prev) => ({
        ...prev,
        nome_completo: profile.nome_completo || '',
      }));
    }
  }, [profile]);

  useEffect(() => {
    if (plataformaUser) {
      setProfileForm((prev) => ({
        ...prev,
        specialty: plataformaUser.specialty || '',
        whatsapp: plataformaUser.whatsapp || '',
        city_state: plataformaUser.city_state || '',
      }));
    }
  }, [plataformaUser]);

  useEffect(() => {
    if (settings) {
      setClinicForm({
        nome: settings.nome || '',
        cnpj: settings.cnpj || '',
        email: settings.email || '',
        telefone: settings.telefone || '',
      });
    }
  }, [settings]);

  const handleProfileSave = () => {
    setIsSavingProfile(true);
    updateProfile(
      { nome_completo: profileForm.nome_completo },
      {
        onSuccess: async () => {
          // Espelha o nome no auth metadata — a saudação da sidebar e do Athos leem daqui primeiro
          await supabase.auth.updateUser({ data: { full_name: profileForm.nome_completo } });
          if (user) {
            await supabase.from('platform_users').update({
              specialty: profileForm.specialty,
              whatsapp: profileForm.whatsapp,
              city_state: profileForm.city_state,
            } as any).eq('id', user.id);
          }
        },
        onSettled: () => setIsSavingProfile(false),
      },
    );
  };

  const handleClinicSave = () => {
    setIsSavingClinic(true);
    updateSettings(clinicForm, {
      onSuccess: async () => {
        // Espelha o nome da clínica em platform_users — é o que o Hub da Plataforma exibe na saudação
        if (user) {
          await supabase.from('platform_users').update({ clinic_name: clinicForm.nome } as any).eq('id', user.id);
        }
      },
      onSettled: () => setIsSavingClinic(false),
    });
  };

  const handleGlobalSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      toast.success('Desconectado de todos os dispositivos.');
    } catch (err: any) {
      toast.error('Erro ao desconectar: ' + err.message);
    }
  };

  const MENU_SECTIONS = [
    // Seções pessoais — visíveis para TODOS os membros
    {
      title: "Conta",
      items: [
        { id: "profile",    label: "Perfil",      icon: User       },
        { id: "security",   label: "Senha",       icon: Lock       },
        { id: "appearance", label: "Aparência",   icon: Palette    },
        { id: "assinatura", label: "Assinatura",  icon: CreditCard },
      ],
    },
    // Seções da organização — apenas dono (isOwner)
    ...(isOwner ? [{
      title: "CRM",
      items: [
        { id: "sources",  label: "Fontes",             icon: Radio     },
        { id: "tags",     label: "Etiquetas",           icon: Tag       },
      ],
    }] : []),
    ...(isOwner ? [{
      title: "Sistema",
      items: [
        { id: "marca",      label: "Marca",      icon: Brush      },
        { id: "whatsapp",   label: "WhatsApp",   icon: Smartphone },
      ],
    }] : []),
    ...(isOwner ? [{
      title: "Equipe",
      items: [
        { id: "team", label: "Equipe Comercial", icon: Users },
      ],
    }] : []),
    {
      title: "Ajuda",
      items: [
        { id: "suporte", label: "Central de Suporte", icon: LifeBuoy },
      ],
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-10 overflow-hidden">
      {/* sr-only section switchers for tutorial/onboarding actions */}
      <button data-tutorial="settings-go-marca" className="sr-only" onClick={() => setActiveSection('marca')} tabIndex={-1} aria-hidden="true" />
      <button data-tutorial="settings-go-tags" className="sr-only" onClick={() => setActiveSection('tags')} tabIndex={-1} aria-hidden="true" />
      <button data-tutorial="settings-go-team" className="sr-only" onClick={() => setActiveSection('team')} tabIndex={-1} aria-hidden="true" />
      <button data-tutorial="settings-go-suporte" className="sr-only" onClick={() => setActiveSection('suporte')} tabIndex={-1} aria-hidden="true" />

      {/* ═══ PAGE HEADER ═══ */}
      <PageHero
        icon={SettingsIcon}
        title="Configurações"
        subtitle="Preferências e ajustes do sistema"
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ═══ SIDEBAR NAV ═══ */}
        <div className="lg:w-60 shrink-0">
          {/* Mobile: horizontal scroll pills */}
          <div className="flex lg:hidden gap-1 overflow-x-auto scrollbar-none pb-1">
            {MENU_SECTIONS.flatMap(s => s.items).map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap shrink-0",
                    isActive
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Desktop: vertical grouped nav */}
          <nav data-tutorial="settings-nav" className="hidden lg:flex flex-col gap-5 sticky top-24">
            {MENU_SECTIONS.map((section) => (
              <div key={section.title}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2 px-3">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        data-tutorial={`settings-nav-${item.id}`}
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 text-left",
                          isActive
                            ? "bg-foreground text-background shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* ═══ CONTENT ═══ */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* ── PROFILE ── */}
          {activeSection === "profile" && (
            <div data-tutorial="settings-profile" className="space-y-5">
              {/* Profile Card */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Meu Perfil</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Gerencie suas informações pessoais</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Avatar + Info */}
                  <div className="flex items-center gap-4">
                    {/* Avatar clicável com overlay de câmera */}
                    <div className="relative shrink-0 group">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="relative block rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        title="Alterar foto"
                      >
                        <Avatar className="h-16 w-16 border-2 border-border/60 shadow-sm">
                          <AvatarImage src={profile?.url_avatar || ''} />
                          <AvatarFallback className="bg-foreground text-background text-lg font-bold">
                            {profile?.nome_completo?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {/* Overlay */}
                        <div className={`absolute inset-0 rounded-full flex items-center justify-center transition-all ${
                          isUploadingAvatar
                            ? 'bg-black/40'
                            : 'bg-black/0 group-hover:bg-black/40'
                        }`}>
                          {isUploadingAvatar
                            ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                            : <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          }
                        </div>
                      </button>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-foreground font-display">
                        {profile?.nome_completo || "Sem nome"}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" /> {user?.email}
                      </p>
                      <p className="text-[10px] text-muted-foreground/40 mt-1">
                        Clique na foto para alterar · JPG, PNG ou WebP · máx 5 MB
                      </p>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Nome Completo
                      </Label>
                      <Input
                        value={profileForm.nome_completo}
                        onChange={e => setProfileForm({...profileForm, nome_completo: e.target.value})}
                        className="h-10 text-sm rounded-lg border-border/60"
                        placeholder="Seu nome"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        E-mail
                      </Label>
                      <Input
                        type="email"
                        value={user?.email || ''}
                        className="h-10 text-sm rounded-lg border-border/60 bg-muted/30 text-muted-foreground"
                        readOnly
                        disabled
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Especialidade
                      </Label>
                      <select
                        value={profileForm.specialty}
                        onChange={e => setProfileForm({ ...profileForm, specialty: e.target.value })}
                        className="flex h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="">Selecione...</option>
                        {ESPECIALIDADES.map((esp) => (
                          <option key={esp} value={esp}>{esp}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        WhatsApp de Contato
                      </Label>
                      <PhoneInput
                        value={profileForm.whatsapp}
                        onChange={e => setProfileForm({ ...profileForm, whatsapp: e.target.value })}
                        placeholder="(00) 00000-0000"
                        className="h-10 text-sm rounded-lg border-border/60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Cidade / UF
                      </Label>
                      <Input
                        value={profileForm.city_state}
                        onChange={e => setProfileForm({ ...profileForm, city_state: e.target.value })}
                        placeholder="Ex: São Paulo, SP"
                        className="h-10 text-sm rounded-lg border-border/60"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end px-5 py-3.5 border-t border-border/40 bg-muted/20">
                  <Button
                    onClick={handleProfileSave}
                    disabled={isSavingProfile}
                    className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
                  >
                    {isSavingProfile ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
                    ) : (
                      <><Save className="h-3.5 w-3.5" /> Salvar Perfil</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Clinic Card */}
              {settings && (
                <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-muted">
                        <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Dados da Clínica</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Informações do seu negócio</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Nome da Clínica
                        </Label>
                        <Input
                          value={clinicForm.nome}
                          onChange={e => setClinicForm({...clinicForm, nome: e.target.value})}
                          className="h-10 text-sm rounded-lg border-border/60"
                          placeholder="Nome do estabelecimento"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          CNPJ
                        </Label>
                        <Input
                          value={clinicForm.cnpj}
                          onChange={e => setClinicForm({...clinicForm, cnpj: e.target.value})}
                          className="h-10 text-sm rounded-lg border-border/60"
                          placeholder="00.000.000/0000-00"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          E-mail da Clínica
                        </Label>
                        <Input
                          type="email"
                          value={clinicForm.email}
                          onChange={e => setClinicForm({...clinicForm, email: e.target.value})}
                          className="h-10 text-sm rounded-lg border-border/60"
                          placeholder="contato@clinica.com"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Telefone da Clínica
                        </Label>
                        <PhoneInput
                          value={clinicForm.telefone}
                          onChange={e => setClinicForm({...clinicForm, telefone: e.target.value})}
                          className="h-10 text-sm rounded-lg border-border/60"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-end px-5 py-3.5 border-t border-border/40 bg-muted/20">
                    <Button
                      onClick={handleClinicSave}
                      disabled={isSavingClinic}
                      className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
                    >
                      {isSavingClinic ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
                      ) : (
                        <><Save className="h-3.5 w-3.5" /> Salvar Clínica</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SECURITY ── */}
          {activeSection === "security" && (
            <div data-tutorial="settings-security" className="space-y-5">
              <PasswordChangeCard />

              {/* Sessões e Acesso */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-muted">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Sessões e Acesso</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Controle onde sua conta está conectada</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-medium text-foreground">Encerrar todas as sessões</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">Desconecta sua conta de todos os dispositivos.</p>
                    </div>
                    <Button
                      onClick={handleGlobalSignOut}
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg text-xs font-medium border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 gap-1.5 shrink-0"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sair de todos os dispositivos
                    </Button>
                  </div>

                  <div className="pt-3 border-t border-border/40 flex flex-wrap gap-x-6 gap-y-1.5 text-[11px] text-muted-foreground/60">
                    <span><span className="font-semibold text-muted-foreground">Membro desde:</span> {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'N/A'}</span>
                    <span><span className="font-semibold text-muted-foreground">Último acesso:</span> {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ASSINATURA ── */}
          {activeSection === "assinatura" && (
            <div data-tutorial="settings-assinatura" className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-muted">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Minha Assinatura</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">Plano e tempo de contrato</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1.5">Plano Atual</p>
                    <p className="text-base font-bold text-foreground font-display">{plan === 'gca' ? 'Gestão Comercial Avançada' : 'Profissional'}</p>
                    <p className="text-[11px] text-muted-foreground font-mono mt-1">{plan?.toUpperCase()}</p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1.5">Status</p>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${contratoVencido ? 'bg-red-500' : 'bg-emerald-500'}`} />
                      <p className="text-base font-bold text-foreground font-display">{contratoVencido ? 'Vencido' : 'Ativo'}</p>
                    </div>
                  </div>
                </div>

                {/* Tempo restante do contrato — só para produtos com prazo definido (não aparece no CRM puro) */}
                {mostrarPrazoContrato && (
                  <div className="rounded-2xl border border-border/60 overflow-hidden">
                    <div className="px-4 py-3.5 border-b border-border/40 bg-muted/[0.03] flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-muted">
                        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tempo de Contrato</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          {contratoInicio && format(contratoInicio, "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                          {' → '}
                          {contratoFim && format(contratoFim, "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-3 divide-x divide-border/40">
                        <div className="pr-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                            {contratoVencido ? 'Dias em atraso' : 'Dias restantes'}
                          </p>
                          <p className={`text-xl font-bold font-display tabular-nums mt-0.5 ${
                            contratoVencido ? 'text-red-600' : (diasRestantes ?? 0) <= 15 ? 'text-amber-600' : 'text-foreground'
                          }`}>
                            {Math.abs(diasRestantes ?? 0)}
                          </p>
                        </div>
                        <div className="px-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Dias utilizados</p>
                          <p className="text-xl font-bold font-display tabular-nums mt-0.5 text-foreground">{diasDecorridos}</p>
                        </div>
                        <div className="pl-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Duração total</p>
                          <p className="text-xl font-bold font-display tabular-nums mt-0.5 text-foreground">{totalDiasContrato}d</p>
                        </div>
                      </div>

                      <div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${contratoVencido ? 'bg-red-500' : (diasRestantes ?? 0) <= 15 ? 'bg-amber-500' : 'bg-foreground'}`}
                            style={{ width: `${pctContratoUsado}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                          {contratoVencido
                            ? `Contrato vencido há ${Math.abs(diasRestantes ?? 0)} dia${Math.abs(diasRestantes ?? 0) !== 1 ? 's' : ''} — entre em contato para renovar.`
                            : `${pctContratoUsado}% do período utilizado · restam ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''}.`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border/40">
                  <p className="text-[12px] text-muted-foreground">Para alterações no plano ou suporte, entre em contato com a Descompliquei.</p>
                  <Button
                    onClick={() => window.open('https://wa.me/5521959359594', '_blank')}
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg text-xs font-medium border-border/60 shrink-0"
                  >
                    Falar com suporte
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── OTHER SECTIONS ── */}
          <div className="w-full overflow-hidden">
            {activeSection === "sources" && <div data-tutorial="settings-sources"><SourceSettings /></div>}
            {activeSection === "tags" && <div data-tutorial="settings-tags"><TagSettings /></div>}
            {activeSection === "marca" && <div data-tutorial="settings-marca"><BrandingSettings /></div>}
            {activeSection === "whatsapp" && <div data-tutorial="settings-whatsapp"><WhatsAppSettings /></div>}
            {activeSection === "appearance" && <div data-tutorial="settings-appearance"><ThemeSettings /></div>}
            {activeSection === "team" && isOwner && <div data-tutorial="settings-team"><TeamSettings /></div>}
            {activeSection === "suporte" && <SuporteTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
