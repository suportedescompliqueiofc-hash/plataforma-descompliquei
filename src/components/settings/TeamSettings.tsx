import { useState } from "react";
import {
  Users, Plus, Trash2, KeyRound, Eye, EyeOff, Pencil, Copy, Check,
  ShieldCheck, Briefcase, Headphones, SlidersHorizontal, ChevronDown, ChevronUp,
  RefreshCw, Loader2, BarChart3, Activity, TrendingUp, DollarSign,
  CalendarDays, UserCheck, Target, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useTeamMembers, TeamMember, ROLE_LABELS, PAGE_LABELS, ROLE_DEFAULTS } from "@/hooks/useTeamMembers";
import { useTeamPerformance } from "@/hooks/useTeamPerformance";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Helpers ───────────────────────────────────────────────────────────────────

function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const PAGE_KEYS = [
  'painel', 'conversas', 'notificacoes', 'leads', 'pipeline',
  'agendamentos', 'vendas', 'procedimentos', 'metas',
  'msgs_rapidas', 'cadencias', 'ia', 'configuracoes', 'plataforma',
] as const;

const ROLE_ICONS: Record<string, React.ElementType> = {
  admin:     ShieldCheck,
  comercial: Briefcase,
  atendente: Headphones,
  custom:    SlidersHorizontal,
};

const ROLE_COLORS: Record<string, string> = {
  admin:     'bg-violet-100 text-violet-700',
  comercial: 'bg-blue-100 text-blue-700',
  atendente: 'bg-emerald-100 text-emerald-700',
  custom:    'bg-amber-100 text-amber-700',
};

// ── PermissionsEditor ─────────────────────────────────────────────────────────

function PermissionsEditor({
  pages,
  readOnly,
  onChange,
}: {
  pages: Record<string, boolean>;
  readOnly: Record<string, boolean>;
  onChange: (pages: Record<string, boolean>, readOnly: Record<string, boolean>) => void;
}) {
  const togglePage = (key: string) => {
    const newPages = { ...pages, [key]: !pages[key] };
    const newReadOnly = !pages[key] ? readOnly : { ...readOnly, [key]: false };
    onChange(newPages, newReadOnly);
  };

  const toggleReadOnly = (key: string) => {
    onChange(pages, { ...readOnly, [key]: !readOnly[key] });
  };

  return (
    <div className="space-y-1.5">
      {PAGE_KEYS.map(key => {
        const hasAccess = pages[key] ?? false;
        const isRO = readOnly[key] ?? false;
        return (
          <div
            key={key}
            className={cn(
              "flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors",
              hasAccess ? "border-border/60 bg-card" : "border-border/30 bg-muted/20 opacity-60"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Switch checked={hasAccess} onCheckedChange={() => togglePage(key)} className="scale-90" />
              <span className="text-[13px] font-medium text-foreground">{PAGE_LABELS[key]}</span>
            </div>
            {hasAccess && (
              <button
                onClick={() => toggleReadOnly(key)}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md transition-colors",
                  isRO
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {isRO ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {isRO ? 'Somente leitura' : 'Acesso completo'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── AddMemberModal ────────────────────────────────────────────────────────────

function AddMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createMember } = useTeamMembers();

  const [email, setEmail]               = useState('');
  const [nome, setNome]                 = useState('');
  const [role, setRole]                 = useState<string>('atendente');
  const [password, setPassword]         = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied]             = useState(false);
  const [pages, setPages]               = useState<Record<string, boolean>>(ROLE_DEFAULTS.atendente);
  const [readOnly, setReadOnly]         = useState<Record<string, boolean>>({});
  const [showPerms, setShowPerms]       = useState(false);
  const [createdId, setCreatedId]       = useState<string | null>(null);

  const handleRoleChange = (r: string) => {
    setRole(r);
    setPages(ROLE_DEFAULTS[r] || ROLE_DEFAULTS.atendente);
    setReadOnly({});
  };

  const handleCreate = async () => {
    if (!email.trim()) return;
    const result = await createMember.mutateAsync({
      email: email.trim(), password, nome: nome.trim(), role, pages, read_only: readOnly,
    });
    if (result?.user_id) setCreatedId(result.user_id);
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setEmail(''); setNome(''); setRole('atendente');
    setPassword(generatePassword()); setShowPassword(false);
    setPages(ROLE_DEFAULTS.atendente); setReadOnly({});
    setShowPerms(false); setCreatedId(null);
    onClose();
  };

  // ── Tela de sucesso ──
  if (createdId) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                <Check className="h-4 w-4 text-emerald-600" />
              </div>
              Membro adicionado!
            </DialogTitle>
            <DialogDescription>
              Repasse as credenciais abaixo para o colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">E-mail</p>
              <p className="text-sm font-medium">{email}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Senha temporária</p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border/60">
                <code className="flex-1 text-sm font-mono font-bold tracking-widest">{password}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyPassword}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/60">
                O colaborador poderá alterar a senha em Configurações após o primeiro acesso.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleClose} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            Adicionar membro
          </DialogTitle>
          <DialogDescription>
            Crie um acesso para um colaborador da sua equipe comercial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Dados básicos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input placeholder="Ex: João Silva" value={nome} onChange={e => setNome(e.target.value)} className="h-10 text-sm rounded-lg border-border/60" />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">E-mail *</Label>
              <Input type="email" placeholder="colaborador@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-10 text-sm rounded-lg border-border/60" />
            </div>
          </div>

          {/* Senha temporária */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Senha temporária</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-10 text-sm rounded-lg border-border/60 pr-9 font-mono"
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg border-border/60 shrink-0" onClick={() => setPassword(generatePassword())} title="Gerar nova senha">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg border-border/60 shrink-0" onClick={copyPassword} title="Copiar senha">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Perfil de acesso */}
          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Perfil de acesso</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['admin', 'comercial', 'atendente', 'custom'] as const).map(r => {
                const Icon = ROLE_ICONS[r];
                return (
                  <button
                    key={r}
                    onClick={() => handleRoleChange(r)}
                    className={cn(
                      "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all",
                      role === r ? "border-foreground/30 bg-foreground/5 shadow-sm" : "border-border/60 hover:border-border hover:bg-muted/30"
                    )}
                  >
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg shrink-0", role === r ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-[12px] font-semibold text-foreground leading-tight">{ROLE_LABELS[r]}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Permissões detalhadas (expansível) */}
          <div>
            <button onClick={() => setShowPerms(!showPerms)} className="flex items-center gap-1.5 w-full text-left py-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
              {showPerms ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Personalizar permissões por página
            </button>
            {showPerms && (
              <div className="mt-2">
                <PermissionsEditor pages={pages} readOnly={readOnly} onChange={(p, ro) => { setPages(p); setReadOnly(ro); }} />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} className="h-9 rounded-lg text-xs border-border/60">Cancelar</Button>
          <Button
            onClick={handleCreate}
            disabled={!email.trim() || createMember.isPending}
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90"
          >
            {createMember.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Adicionar membro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── EditMemberModal ───────────────────────────────────────────────────────────

function EditMemberModal({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const { updateMember, resetPassword } = useTeamMembers();
  const [role, setRole]                   = useState(member.role);
  const [nome, setNome]                   = useState(member.nome || '');
  const [pages, setPages]                 = useState<Record<string, boolean>>(member.pages);
  const [readOnly, setReadOnly]           = useState<Record<string, boolean>>(member.read_only || {});
  const [newPassword, setNewPassword]     = useState('');
  const [showNewPwd, setShowNewPwd]       = useState(false);
  const [tab, setTab]                     = useState<'permissions' | 'password'>('permissions');

  const handleRoleChange = (r: string) => {
    setRole(r);
    setPages(ROLE_DEFAULTS[r] || ROLE_DEFAULTS.atendente);
    setReadOnly({});
  };

  const handleSave = async () => {
    await updateMember.mutateAsync({ user_id: member.user_id, nome: nome.trim(), role, pages, read_only: readOnly });
    onClose();
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) return;
    await resetPassword.mutateAsync({ user_id: member.user_id, new_password: newPassword });
    setNewPassword('');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </div>
            Editar {member.nome || member.email}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs internas */}
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1 mb-1">
          {(['permissions', 'password'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-1.5 text-[12px] font-medium rounded-lg transition-all",
                tab === t ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === 'permissions' ? 'Permissões' : 'Redefinir Senha'}
            </button>
          ))}
        </div>

        {tab === 'permissions' && (
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} className="h-10 text-sm rounded-lg border-border/60" />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Perfil de acesso</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['admin', 'comercial', 'atendente', 'custom'] as const).map(r => {
                  const Icon = ROLE_ICONS[r];
                  return (
                    <button key={r} onClick={() => handleRoleChange(r)} className={cn("flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all", role === r ? "border-foreground/30 bg-foreground/5 shadow-sm" : "border-border/60 hover:border-border hover:bg-muted/30")}>
                      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg shrink-0", role === r ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <p className="text-[12px] font-semibold">{ROLE_LABELS[r]}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Permissões por página</Label>
              <PermissionsEditor pages={pages} readOnly={readOnly} onChange={(p, ro) => { setPages(p); setReadOnly(ro); }} />
            </div>
          </div>
        )}

        {tab === 'password' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Nova senha para <strong>{member.nome || member.email}</strong>. Mínimo 6 caracteres.
            </p>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nova senha</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showNewPwd ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="h-10 text-sm rounded-lg border-border/60 pr-9"
                  />
                  <button onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg border-border/60 shrink-0" onClick={() => setNewPassword(generatePassword())}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Button
              onClick={handleResetPassword}
              disabled={newPassword.length < 6 || resetPassword.isPending}
              className="w-full h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90"
            >
              {resetPassword.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Redefinir senha
            </Button>
          </div>
        )}

        {tab === 'permissions' && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} className="h-9 rounded-lg text-xs border-border/60">Cancelar</Button>
            <Button onClick={handleSave} disabled={updateMember.isPending} className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90">
              {updateMember.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── TeamPerformanceDashboard ──────────────────────────────────────────────────

const SCORING_COLORS: Record<string, string> = {
  A: 'bg-emerald-500', B: 'bg-blue-500', C: 'bg-amber-500', D: 'bg-red-500',
};
const TIPO_ICON: Record<string, React.ElementType> = {
  criacao:     Plus,
  etapa:       SlidersHorizontal,
  responsavel: Users,
};
const TIPO_COLOR: Record<string, string> = {
  criacao:     'bg-emerald-100 text-emerald-700',
  etapa:       'bg-amber-100 text-amber-700',
  responsavel: 'bg-indigo-100 text-indigo-700',
};

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function TeamPerformanceDashboard() {
  const { memberStats, recentActivity, isLoading } = useTeamPerformance();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasAnyData = memberStats.some(m => m.totalLeads > 0 || m.atividadesCount > 0);

  return (
    <div className="space-y-6">

      {/* ── Cards por membro ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Performance por Membro</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Métricas acumuladas de todos os períodos</p>
            </div>
          </div>
        </div>

        {memberStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <BarChart3 className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum membro na equipe</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Adicione membros para visualizar o desempenho.</p>
          </div>
        ) : !hasAnyData ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <div className="p-3 rounded-xl bg-muted/40 mb-3">
              <Activity className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Sem dados ainda</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">As métricas aparecerão conforme os membros forem atribuídos aos leads.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {memberStats.map(ms => {
              const initials = ms.member.nome.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
              const roleColor = {
                owner: 'bg-violet-100 text-violet-700',
                admin: 'bg-violet-100 text-violet-700',
                comercial: 'bg-blue-100 text-blue-700',
                atendente: 'bg-emerald-100 text-emerald-700',
                custom: 'bg-amber-100 text-amber-700',
              }[ms.member.role] || 'bg-muted text-muted-foreground';

              return (
                <div key={ms.member.id} className="px-5 py-5">
                  {/* Header do membro */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border/60">
                      {ms.member.url_avatar
                        ? <img src={ms.member.url_avatar} className="h-full w-full object-cover" />
                        : <span className="text-sm font-bold text-muted-foreground">{initials}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold text-foreground">{ms.member.nome}</p>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", roleColor)}>
                          {ROLE_LABELS[ms.member.role] || ms.member.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 truncate">{ms.member.email}</p>
                    </div>
                    {ms.taxaConversao > 0 && (
                      <div className="text-right shrink-0">
                        <span className="text-[11px] text-muted-foreground/50 block">Conversão</span>
                        <span className={cn(
                          "text-[18px] font-extrabold tabular-nums font-display",
                          ms.taxaConversao >= 20 ? 'text-emerald-600' : ms.taxaConversao >= 10 ? 'text-amber-600' : 'text-foreground'
                        )}>{ms.taxaConversao}%</span>
                      </div>
                    )}
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      { icon: Users,       label: 'Leads',         value: ms.totalLeads,        color: 'text-foreground' },
                      { icon: UserCheck,   label: 'Qualificados',  value: ms.leadsQualificados,  color: 'text-emerald-600' },
                      { icon: CalendarDays,label: 'Agendamentos',  value: ms.leadsAgendados,     color: 'text-purple-600' },
                      { icon: DollarSign,  label: 'Vendas',        value: ms.totalVendas,        color: 'text-blue-600' },
                    ].map(({ icon: Icon, label, value, color }) => (
                      <div key={label} className="rounded-xl border border-border/60 bg-muted/20 p-3.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Icon className={cn("h-3.5 w-3.5", color)} />
                          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">{label}</span>
                        </div>
                        <span className={cn("text-[22px] font-extrabold tabular-nums font-display", color)}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Faturamento se houver vendas */}
                  {ms.faturamento > 0 && (
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-[12px] text-muted-foreground">Faturamento atribuído:</span>
                      <span className="text-[13px] font-bold text-emerald-600 tabular-nums">{formatCurrency(ms.faturamento)}</span>
                    </div>
                  )}

                  {/* Distribuição de scoring */}
                  {Object.keys(ms.scoringDist).length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2 px-1">Scoring dos leads</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['A','B','C','D'].filter(s => ms.scoringDist[s] > 0).map(s => (
                          <span key={s} className={cn(
                            "flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg text-white",
                            SCORING_COLORS[s]
                          )}>
                            <Target className="h-2.5 w-2.5" />
                            {s} · {ms.scoringDist[s]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Feed de atividades recentes ── */}
      {recentActivity.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Atividades Recentes</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">Últimas ações da equipe no CRM</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-border/40 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
            {recentActivity.map(at => {
              const Icon = TIPO_ICON[at.tipo] || Activity;
              const colorClass = TIPO_COLOR[at.tipo] || 'bg-muted text-muted-foreground';
              const autorInitials = at.autor
                ? at.autor.nome.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
                : '?';

              return (
                <div key={at.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                  {/* Ícone do tipo */}
                  <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg shrink-0 mt-0.5", colorClass)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Avatar do autor */}
                      {at.autor && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center overflow-hidden ring-1 ring-border/60">
                            {at.autor.url_avatar
                              ? <img src={at.autor.url_avatar} className="h-full w-full object-cover" />
                              : <span className="text-[8px] font-bold text-muted-foreground">{autorInitials}</span>
                            }
                          </div>
                          <span className="text-[12px] font-semibold text-foreground">{at.autor.nome}</span>
                        </div>
                      )}
                      <span className="text-[12px] text-muted-foreground">{at.descricao}</span>
                      {at.lead && (
                        <>
                          <span className="text-muted-foreground/40 text-[11px]">em</span>
                          <span className="text-[12px] font-medium text-foreground truncate max-w-[160px]">
                            {at.lead.nome || at.lead.telefone}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground/40" />
                      <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                        {formatDistanceToNow(new Date(at.criado_em), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TeamSettings ──────────────────────────────────────────────────────────────

export function TeamSettings() {
  const { members, isLoading, deleteMember } = useTeamMembers();
  const [showAdd, setShowAdd]               = useState(false);
  const [editing, setEditing]               = useState<TeamMember | null>(null);
  const [deleting, setDeleting]             = useState<TeamMember | null>(null);
  const [activeTab, setActiveTab]           = useState<'membros' | 'desempenho'>('membros');

  return (
    <div className="space-y-5">

      {/* Barra de tabs + ação */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
          {(['membros', 'desempenho'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                "px-4 py-1.5 text-[12px] font-semibold rounded-lg transition-all",
                activeTab === t
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === 'membros' ? 'Membros' : 'Desempenho'}
            </button>
          ))}
        </div>
        {activeTab === 'membros' && (
          <Button
            onClick={() => setShowAdd(true)}
            className="h-8 rounded-lg text-[11px] font-medium bg-foreground text-background hover:bg-foreground/90 px-3 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar membro
          </Button>
        )}
      </div>

      {/* ── Aba: Membros ── */}
      {activeTab === 'membros' && (
        <>
          {/* Card principal */}
          <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-muted">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">EQUIPE COMERCIAL</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {members.length === 0
                      ? 'Nenhum membro adicionado'
                      : `${members.length} membro${members.length !== 1 ? 's' : ''} na equipe`}
                  </p>
                </div>
              </div>
            </div>

            {/* Lista */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="p-3 rounded-xl bg-muted/40 mb-3">
                  <Users className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Nenhum membro ainda</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5 max-w-xs">
                  Adicione colaboradores para dar acesso ao CRM com permissões controladas.
                </p>
                <Button
                  onClick={() => setShowAdd(true)}
                  variant="outline"
                  className="mt-4 h-8 rounded-lg text-[11px] border-border/60 gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar primeiro membro
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {members.map(member => {
                  const Icon = ROLE_ICONS[member.role] || SlidersHorizontal;
                  const colorClass = ROLE_COLORS[member.role] || 'bg-muted text-muted-foreground';
                  const pagesCount = Object.values(member.pages).filter(Boolean).length;
                  const hasReadOnly = Object.values(member.read_only || {}).some(Boolean);

                  return (
                    <div key={member.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted border border-border/40 shrink-0">
                        <span className="text-sm font-bold text-muted-foreground">
                          {(member.nome || member.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] font-semibold text-foreground truncate">{member.nome || '—'}</p>
                          <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full", colorClass)}>
                            <Icon className="h-2.5 w-2.5" />
                            {ROLE_LABELS[member.role] || member.role}
                          </span>
                          {hasReadOnly && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              <EyeOff className="h-2.5 w-2.5" />
                              Leitura restrita
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{member.email}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          {pagesCount} página{pagesCount !== 1 ? 's' : ''} com acesso · adicionado em {format(new Date(member.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 rounded-lg"
                          onClick={() => setEditing(member)} title="Editar permissões"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleting(member)} title="Remover membro"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Como funciona</p>
            <ul className="space-y-1 text-[11px] text-muted-foreground/70">
              <li>• O colaborador acessa com o e-mail e a senha temporária que você definir</li>
              <li>• <strong className="text-muted-foreground">Administrador</strong> — acesso amplo (exceto Configurações por padrão)</li>
              <li>• <strong className="text-muted-foreground">Comercial</strong> — Leads, Pipeline, Agendamentos, Vendas e Metas</li>
              <li>• <strong className="text-muted-foreground">Atendente</strong> — apenas Conversas e Notificações</li>
              <li>• <strong className="text-muted-foreground">Personalizado</strong> — você define página por página</li>
              <li>• "Somente leitura" permite visualizar mas não criar/editar/excluir</li>
            </ul>
          </div>
        </>
      )}

      {/* ── Aba: Desempenho ── */}
      {activeTab === 'desempenho' && <TeamPerformanceDashboard />}

      {/* Modais */}
      <AddMemberModal open={showAdd} onClose={() => setShowAdd(false)} />
      {editing && <EditMemberModal member={editing} onClose={() => setEditing(null)} />}

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleting?.nome || deleting?.email}</strong>?
              O acesso ao CRM será revogado imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleting) deleteMember.mutate(deleting.user_id); setDeleting(null); }}
            >
              Remover membro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
