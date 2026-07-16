import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { toast } from 'sonner';

export interface TeamMember {
  id: string;
  user_id: string;
  organization_id: string;
  email: string;
  nome: string;
  role: string;
  pages: Record<string, boolean>;
  read_only: Record<string, boolean>;
  criado_em: string;
}

export interface CreateMemberInput {
  email: string;
  password?: string;
  nome: string;
  role: string;
  pages: Record<string, boolean>;
  read_only: Record<string, boolean>;
}

export const ROLE_LABELS: Record<string, string> = {
  admin:     'Administrador',
  comercial: 'Comercial',
  atendente: 'Atendente',
  custom:    'Personalizado',
};

export const PAGE_LABELS: Record<string, string> = {
  painel:          'Painel de Controle',
  performance:     'Performance',
  conversas:       'Conversas',
  notificacoes:    'Notificações',
  leads:           'Leads',
  agendamentos:    'Agendamentos',
  vendas:          'Vendas',
  procedimentos:   'Procedimentos',
  metas:           'Metas',
  equipe:          'Equipe',
  evolucao:        'Evolução',
  ia:              'Agentes de IA',
  athos_gs:        'Athos GS',
  arsenal:         'Arsenal',
  jornada:         'Jornada',
  notas:           'Notas',
  sessoes_taticas: 'Sessões Táticas',
  cadencias:       'Cadências',
  atualizacoes:    'Atualizações',
  configuracoes:   'Configurações',
};

export const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  admin: {
    painel: true, performance: true, conversas: true, notificacoes: true, leads: true,
    agendamentos: true, vendas: true, procedimentos: true, metas: true, equipe: true,
    evolucao: true, ia: true, athos_gs: false, arsenal: false, jornada: false, notas: false,
    sessoes_taticas: false, cadencias: true, atualizacoes: true, configuracoes: false,
  },
  comercial: {
    painel: true, performance: true, conversas: true, notificacoes: true, leads: true,
    agendamentos: true, vendas: true, procedimentos: false, metas: true, equipe: false,
    evolucao: true, ia: false, athos_gs: false, arsenal: false, jornada: false, notas: false,
    sessoes_taticas: false, cadencias: false, atualizacoes: true, configuracoes: false,
  },
  atendente: {
    painel: false, performance: false, conversas: true, notificacoes: true, leads: false,
    agendamentos: false, vendas: false, procedimentos: false, metas: false, equipe: false,
    evolucao: false, ia: false, athos_gs: false, arsenal: false, jornada: false, notas: false,
    sessoes_taticas: false, cadencias: false, atualizacoes: true, configuracoes: false,
  },
  custom: {
    painel: false, performance: false, conversas: true, notificacoes: true, leads: false,
    agendamentos: false, vendas: false, procedimentos: false, metas: false, equipe: false,
    evolucao: false, ia: false, athos_gs: false, arsenal: false, jornada: false, notas: false,
    sessoes_taticas: false, cadencias: false, atualizacoes: true, configuracoes: false,
  },
};

async function callManageTeam(action: string, payload: object) {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke('manage-team', {
    body: { action, ...payload },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useTeamMembers() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('team_member_permissions' as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('criado_em', { ascending: true });
      if (error) throw error;
      return (data || []) as TeamMember[];
    },
    enabled: !!orgId,
  });

  const createMember = useMutation({
    mutationFn: (input: CreateMemberInput) => callManageTeam('create_member', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', orgId] });
      toast.success('Membro adicionado com sucesso.');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao adicionar membro'),
  });

  const updateMember = useMutation({
    mutationFn: (input: { user_id: string; nome?: string; role?: string; pages?: Record<string, boolean>; read_only?: Record<string, boolean> }) =>
      callManageTeam('update_member', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', orgId] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      toast.success('Permissões atualizadas com sucesso.');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar permissões'),
  });

  const resetPassword = useMutation({
    mutationFn: (input: { user_id: string; new_password: string }) =>
      callManageTeam('reset_password', input),
    onSuccess: () => toast.success('Senha redefinida com sucesso.'),
    onError: (err: any) => toast.error(err.message || 'Erro ao redefinir senha'),
  });

  const deleteMember = useMutation({
    mutationFn: (user_id: string) => callManageTeam('delete_member', { user_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', orgId] });
      toast.success('Membro removido com sucesso.');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao remover membro'),
  });

  const sendAccessEmail = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/atualizar-senha`,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Email de acesso enviado com sucesso!'),
    onError: (err: any) => toast.error(err.message || 'Erro ao enviar email de acesso'),
  });

  return { members, isLoading, createMember, updateMember, resetPassword, deleteMember, sendAccessEmail };
}
