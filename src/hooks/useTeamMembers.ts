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
  password: string;
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
  painel:       'Painel de Controle',
  conversas:    'Conversas',
  notificacoes: 'Notificações',
  leads:        'Leads',
  pipeline:     'Pipeline',
  agendamentos: 'Agendamentos',
  vendas:       'Vendas',
  procedimentos:'Procedimentos',
  metas:        'Metas',
  msgs_rapidas: 'Mensagens Rápidas',
  cadencias:    'Cadências',
  ia:           'Inteligência Artificial',
  configuracoes:'Configurações',
  plataforma:   'Plataforma',
};

export const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  admin: {
    painel: true, conversas: true, notificacoes: true, leads: true, pipeline: true,
    agendamentos: true, vendas: true, procedimentos: true, metas: true,
    msgs_rapidas: true, cadencias: true, ia: true, configuracoes: false, plataforma: false,
  },
  comercial: {
    painel: true, conversas: true, notificacoes: true, leads: true, pipeline: true,
    agendamentos: true, vendas: true, procedimentos: false, metas: true,
    msgs_rapidas: false, cadencias: false, ia: false, configuracoes: false, plataforma: false,
  },
  atendente: {
    painel: false, conversas: true, notificacoes: true, leads: false, pipeline: false,
    agendamentos: false, vendas: false, procedimentos: false, metas: false,
    msgs_rapidas: true, cadencias: false, ia: false, configuracoes: false, plataforma: false,
  },
  custom: {
    painel: false, conversas: true, notificacoes: true, leads: false, pipeline: false,
    agendamentos: false, vendas: false, procedimentos: false, metas: false,
    msgs_rapidas: false, cadencias: false, ia: false, configuracoes: false, plataforma: false,
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

  return { members, isLoading, createMember, updateMember, resetPassword, deleteMember };
}
