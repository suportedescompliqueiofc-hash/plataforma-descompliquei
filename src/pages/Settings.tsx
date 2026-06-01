import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Save,
  Palette,
  Tag,
  GitBranch,
  Radio,
  Smartphone,
  Brush,
  Lock,
  Settings as SettingsIcon,
  Loader2,
  Mail,
  Users,
  Camera,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useClinicSettings } from "@/hooks/useClinicSettings";
import { supabase } from "@/integrations/supabase/client";
import { ThemeSettings } from "@/components/settings/ThemeSettings";
import { TagSettings } from "@/components/settings/TagSettings";
import { PipelineSettings } from "@/components/settings/PipelineSettings";
import { SourceSettings } from "@/components/settings/SourceSettings";
import { BrandingSettings } from "@/components/settings/BrandingSettings";
import { WhatsAppSettings } from "@/components/settings/WhatsAppSettings";
import PasswordChangeCard from "@/components/settings/PasswordChangeCard";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

// Alias simples — o campo de telefone usa o mesmo Input base
const PhoneInput = Input;

export default function Settings() {
  // Lê seção da query string (?section=marca) para deep-link do onboarding
  const searchParams = new URLSearchParams(window.location.search);
  const initialSection = searchParams.get('section') || 'profile';
  const [activeSection, setActiveSection] = useState(initialSection);
  const { user } = useAuth();
  const { profile, role, isLoading: isLoadingProfile, updateProfile } = useProfile();
  const { isOwner } = usePermissions();
  const { settings, updateSettings } = useClinicSettings();

  const [profileForm, setProfileForm] = useState({ nome_completo: '' });
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
      setProfileForm({
        nome_completo: profile.nome_completo || '',
      });
    }
  }, [profile]);

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
    updateProfile(profileForm, {
      onSettled: () => setIsSavingProfile(false),
    });
  };

  const handleClinicSave = () => {
    setIsSavingClinic(true);
    updateSettings(clinicForm, {
      onSettled: () => setIsSavingClinic(false),
    });
  };

  const MENU_SECTIONS = [
    // Seções pessoais — visíveis para TODOS os membros
    {
      title: "Conta",
      items: [
        { id: "profile",    label: "Perfil",     icon: User    },
        { id: "security",   label: "Senha",      icon: Lock    },
        { id: "appearance", label: "Aparência",  icon: Palette },
      ],
    },
    // Seções da organização — apenas dono (isOwner)
    ...(isOwner ? [{
      title: "CRM",
      items: [
        { id: "pipeline", label: "Etapas do Pipeline", icon: GitBranch },
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
  ];

  return (
    <div className="space-y-6 pb-10 max-w-full overflow-hidden">
      {/* sr-only section switchers for tutorial/onboarding actions */}
      <button data-tutorial="settings-go-marca" className="sr-only" onClick={() => setActiveSection('marca')} tabIndex={-1} aria-hidden="true" />
      <button data-tutorial="settings-go-tags" className="sr-only" onClick={() => setActiveSection('tags')} tabIndex={-1} aria-hidden="true" />
      <button data-tutorial="settings-go-team" className="sr-only" onClick={() => setActiveSection('team')} tabIndex={-1} aria-hidden="true" />

      {/* ═══ PAGE HEADER ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-muted">
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Configurações</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">Preferências e ajustes do sistema</p>
      </div>

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
                      <p className="text-sm font-semibold text-foreground">
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

          {/* ── OTHER SECTIONS ── */}
          <div className="w-full overflow-hidden">
            {activeSection === "pipeline" && <div data-tutorial="settings-pipeline"><PipelineSettings /></div>}
            {activeSection === "sources" && <div data-tutorial="settings-sources"><SourceSettings /></div>}
            {activeSection === "tags" && <div data-tutorial="settings-tags"><TagSettings /></div>}
            {activeSection === "marca" && <div data-tutorial="settings-marca"><BrandingSettings /></div>}
            {activeSection === "whatsapp" && <div data-tutorial="settings-whatsapp"><WhatsAppSettings /></div>}
            {activeSection === "appearance" && <div data-tutorial="settings-appearance"><ThemeSettings /></div>}
            {activeSection === "security" && <div data-tutorial="settings-security"><PasswordChangeCard /></div>}
            {activeSection === "team" && isOwner && <div data-tutorial="settings-team"><TeamSettings /></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
