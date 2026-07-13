// Conversas do Athos CS (Admin OS). Cross-org, admin-only.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CsAthosConversation {
  id: string;
  client_org_id: string | null;
  titulo: string | null;
  updated_at: string;
}

export interface CsAthosMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Lista conversas do CSM (opcionalmente filtradas por cliente).
export function useCsAthosConversations(clientOrgId?: string | null) {
  return useQuery({
    queryKey: ['cs-athos-conversations', clientOrgId ?? 'geral'],
    staleTime: 30 * 1000,
    queryFn: async (): Promise<CsAthosConversation[]> => {
      let q = (supabase as any)
        .from('cs_athos_conversations')
        .select('id, client_org_id, titulo, updated_at')
        .order('updated_at', { ascending: false })
        .limit(30);
      q = clientOrgId ? q.eq('client_org_id', clientOrgId) : q.is('client_org_id', null);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CsAthosConversation[];
    },
  });
}

// Carrega as mensagens de uma conversa.
export async function loadCsAthosMessages(conversationId: string): Promise<CsAthosMessage[]> {
  const { data, error } = await (supabase as any)
    .from('cs_athos_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((m: any) => ({ role: m.role, content: m.content ?? '' }));
}

export function useInvalidateCsAthos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['cs-athos-conversations'] });
}
