import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Profile {
  id: string;
  nome_completo?: string;
  url_avatar?: string;
  telefone?: string;
  atualizado_em: string;
  organization_id?: string;
}

export function useProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        return data as Profile;
      }

      console.log("Perfil não encontrado. Iniciando auto-criação...");
      
      const orgName = (user.user_metadata?.full_name || 'Meu') + ' Escritório';
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName } as any)
        .select()
        .single();

      if (orgError) {
        throw orgError;
      }

      const newProfile = {
        id: user.id,
        nome_completo: user.user_metadata?.full_name || 'Novo Usuário',
        organization_id: newOrg?.id
      };

      const { data: createdProfile, error: profileError } = await supabase
        .from('perfis')
        .insert(newProfile as any)
        .select()
        .single();

      if (profileError) {
        throw profileError;
      }

      await supabase.from('usuarios_papeis').insert({
        usuario_id: user.id,
        papel: 'admin'
      } as any);

      // Semear etapas padrão do pipeline para a nova organização
      const DEFAULT_STAGES = [
        { nome: 'Em Atendimento',       cor: '#f97316', posicao_ordem: 1, em_funil: false },
        { nome: 'Qualificação',         cor: '#3b82f6', posicao_ordem: 2, em_funil: false },
        { nome: 'Qualificado',          cor: '#8b5cf6', posicao_ordem: 3, em_funil: false },
        { nome: 'Handoff',              cor: '#a855f7', posicao_ordem: 4, em_funil: true  },
        { nome: 'Agendado',             cor: '#10b981', posicao_ordem: 5, em_funil: true  },
        { nome: 'Procedimento Fechado', cor: '#22c55e', posicao_ordem: 6, em_funil: true  },
      ];
      await supabase.from('etapas').insert(
        DEFAULT_STAGES.map(s => ({ ...s, organization_id: newOrg.id })) as any
      );

      return createdProfile as Profile;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutos — impersonação usa window.location.href (full reload limpa cache)
    retry: 1,
  });

  const { data: role, isLoading: isLoadingRole } = useQuery({
    queryKey: ['user_role', user?.id],
    queryFn: async () => {
      if (!user) return null;
      // Buscar TODOS os papéis e priorizar superadmin > admin > atendente
      const { data } = await supabase
        .from('usuarios_papeis')
        .select('papel')
        .eq('usuario_id', user.id);
      if (!data || data.length === 0) return 'atendente';
      const papeis = data.map((d: any) => d.papel as string);
      if (papeis.includes('superadmin')) return 'superadmin';
      if (papeis.includes('admin')) return 'admin';
      return papeis[0] || 'atendente';
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 1, // Reduzido para 1 minuto para maior reatividade em mudanças de permissão
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Omit<Profile, 'id' | 'atualizado_em' | 'organization_id'>>) => {
      if (!user) throw new Error("Usuário não autenticado");
      
      const { data, error } = await supabase
        .from('perfis')
        .update(updates as any)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Perfil atualizado com sucesso!', { closeButton: true });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar perfil', { closeButton: true });
    },
  });

  return { profile, role, isLoading: isLoading || isLoadingRole, updateProfile: updateProfile.mutate };
}