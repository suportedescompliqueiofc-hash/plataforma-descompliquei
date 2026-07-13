import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, ArrowRight, CheckCircle2,
  Headphones, Briefcase, ShieldCheck, SlidersHorizontal,
  MessageSquare, Users, CalendarDays, DollarSign, BarChart3,
  Zap, Bell, Bot, Target, Layers,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useTutorialContext } from '@/components/tutorial/TutorialProvider';
import { PAGE_LABELS, ROLE_LABELS } from '@/hooks/useTeamMembers';

// ── Ícone por página ──────────────────────────────────────────────────────────

const PAGE_ICONS: Record<string, React.ElementType> = {
  conversas:    MessageSquare,
  leads:        Users,
  agendamentos: CalendarDays,
  vendas:       DollarSign,
  metas:        Target,
  notificacoes: Bell,
  painel:       BarChart3,
  ia:           Bot,
  cadencias:    Layers,
  equipe:       Users,
  procedimentos: SlidersHorizontal,
  configuracoes: ShieldCheck,
};

// ── Ícone e cor por papel ─────────────────────────────────────────────────────

const ROLE_META: Record<string, { icon: React.ElementType; color: string }> = {
  admin:     { icon: ShieldCheck, color: 'bg-violet-100 text-violet-700' },
  comercial: { icon: Briefcase,   color: 'bg-blue-100 text-blue-700'    },
  atendente: { icon: Headphones,  color: 'bg-emerald-100 text-emerald-700' },
  custom:    { icon: SlidersHorizontal, color: 'bg-amber-100 text-amber-700' },
};

// ── Sugestão de tour por papel ────────────────────────────────────────────────

const ROLE_SUGGESTION: Record<string, { tutorialId: string; path: string; label: string; description: string }> = {
  atendente: {
    tutorialId: 'conversas',
    path: '/crm/conversas',
    label: 'Tour pelo módulo Conversas',
    description: 'Como atendente, você vai trabalhar principalmente respondendo leads pelo chat. O tour mostra como filtrar e responder.',
  },
  comercial: {
    tutorialId: 'leads',
    path: '/crm/leads',
    label: 'Tour pelo módulo Leads',
    description: 'Como comercial, seu foco é acompanhar Leads, Agendamentos e Vendas. O tour mostra como qualificar e avançar cada lead no processo.',
  },
  admin: {
    tutorialId: 'dashboard',
    path: '/crm',
    label: 'Tour pelo Painel de Controle',
    description: 'Como administrador, você tem acesso amplo. Comece pelo Painel para entender os números e o fluxo geral do CRM.',
  },
  custom: {
    tutorialId: 'conversas',
    path: '/crm/conversas',
    label: 'Tour pelo CRM',
    description: 'Conheça as funcionalidades disponíveis no seu perfil. O tour mostra como navegar e usar o CRM no dia a dia.',
  },
};

// ── Hook ──────────────────────────────────────────────────────────────────────

interface MemberData {
  user_id: string;
  nome: string;
  email: string;
  role: string;
  pages: Record<string, boolean>;
  read_only: Record<string, boolean>;
  organization_id: string;
}

function useMemberWelcome() {
  const { profile } = useProfile();
  const userId = profile?.id;
  const orgId  = profile?.organization_id;

  const [memberData, setMemberData]   = useState<MemberData | null>(null);
  const [orgName, setOrgName]         = useState<string>('');
  const [isChecking, setIsChecking]   = useState(true);

  useEffect(() => {
    if (!userId || !orgId) return;

    const seen = localStorage.getItem(`crm_member_welcome_${userId}`);
    if (seen) { setIsChecking(false); return; }

    Promise.all([
      supabase
        .from('team_member_permissions' as any)
        .select('*')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .maybeSingle(),
    ]).then(([{ data: member }, { data: org }]) => {
      if (member) setMemberData(member as MemberData);
      if (org?.name) setOrgName(org.name);
      setIsChecking(false);
    });
  }, [userId, orgId]);

  const markSeen = () => {
    if (userId) localStorage.setItem(`crm_member_welcome_${userId}`, '1');
    setMemberData(null);
  };

  return { memberData, orgName, isChecking, markSeen };
}

// ── Componente principal ──────────────────────────────────────────────────────

export function MemberWelcomeModal() {
  const { memberData, orgName, isChecking, markSeen } = useMemberWelcome();
  const { startTutorial } = useTutorialContext();
  const navigate = useNavigate();

  if (isChecking || !memberData) return null;

  const role     = memberData.role || 'atendente';
  const roleMeta = ROLE_META[role] || ROLE_META.atendente;
  const RoleIcon = roleMeta.icon;
  const suggestion = ROLE_SUGGESTION[role] || ROLE_SUGGESTION.atendente;

  const accessiblePages = Object.entries(memberData.pages || {})
    .filter(([, v]) => v)
    .map(([k]) => k);

  const SHOW_MAX = 6;
  const visiblePages = accessiblePages.slice(0, SHOW_MAX);
  const hiddenCount  = accessiblePages.length - SHOW_MAX;

  const handleTour = () => {
    markSeen();
    navigate(suggestion.path);
    setTimeout(() => startTutorial(suggestion.tutorialId), 700);
  };

  const handleEnter = () => {
    markSeen();
  };

  return (
    <Dialog open onOpenChange={handleEnter}>
      <DialogContent
        className="max-w-md p-0 gap-0 rounded-2xl border border-border/60 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="bg-foreground px-6 pt-8 pb-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-background font-display leading-tight mb-1">
            Bem-vindo(a) ao CRM!
          </h2>
          {memberData.nome && (
            <p className="text-background/60 text-[13px]">{memberData.nome}</p>
          )}
          {orgName && (
            <p className="text-background/40 text-[11px] mt-0.5">{orgName}</p>
          )}
        </div>

        {/* Corpo */}
        <div className="px-6 py-5 space-y-5 bg-card">

          {/* Papel atribuído */}
          <div className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3 bg-muted/20">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', roleMeta.color)}>
              <RoleIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Seu papel</p>
              <p className="text-[13px] font-semibold text-foreground">
                {ROLE_LABELS[role] || role}
              </p>
            </div>
          </div>

          {/* Páginas com acesso */}
          {visiblePages.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">
                Páginas disponíveis
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visiblePages.map((page) => {
                  const Icon = PAGE_ICONS[page] || Layers;
                  return (
                    <span
                      key={page}
                      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border/60 bg-muted/30 text-foreground"
                    >
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      {PAGE_LABELS[page] || page}
                    </span>
                  );
                })}
                {hiddenCount > 0 && (
                  <span className="flex items-center text-[11px] font-medium px-2.5 py-1 rounded-lg border border-border/60 bg-muted/30 text-muted-foreground">
                    +{hiddenCount} mais
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Sugestão de tour */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-foreground mb-1">
                  Por onde começar
                </p>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  {suggestion.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border/40 bg-muted/20">
          <Button
            variant="outline"
            onClick={handleEnter}
            className="h-9 rounded-lg text-[12px] font-medium border-border/60 flex-1"
          >
            Entrar no CRM
          </Button>
          <Button
            onClick={handleTour}
            className="h-9 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 flex-1 gap-1.5"
          >
            Fazer tour
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
