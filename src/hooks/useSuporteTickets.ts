import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';

export type TicketCategoria = 'bug' | 'melhoria' | 'duvida' | 'outro';
export type TicketPrioridade = 'baixa' | 'media' | 'alta' | 'critica';
export type TicketStatus = 'aberto' | 'em_analise' | 'aguardando_info' | 'resolvido' | 'fechado';

export interface SuporteTicket {
  id: string;
  organization_id: string;
  criado_por: string;
  numero_ticket: number;
  titulo: string;
  categoria: TicketCategoria;
  prioridade: TicketPrioridade;
  descricao: string;
  status: TicketStatus;
  visualizado_admin: boolean;
  created_at: string;
  updated_at: string;
  // joins
  organizations?: { name: string };
  perfis?: { nome_completo: string | null };
  mensagens?: TicketMensagem[];
  midias?: TicketMidia[];
}

export interface TicketMensagem {
  id: string;
  ticket_id: string;
  organization_id: string;
  autor_id: string;
  autor_tipo: 'cliente' | 'admin';
  autor_nome: string;
  conteudo: string;
  created_at: string;
}

export interface TicketMidia {
  id: string;
  ticket_id: string;
  nome_arquivo: string;
  tipo: 'image' | 'video';
  mime_type: string;
  tamanho_bytes: number | null;
  storage_path: string;
  url_publica: string;
  created_at: string;
}

// ── Client-facing hooks ──────────────────────────────────────────────────────

export function useTickets() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['suporte_tickets', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suporte_tickets')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });
}

export function useTicketDetalhe(ticketId: string | null) {
  return useQuery({
    queryKey: ['suporte_ticket', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suporte_tickets')
        .select('*')
        .eq('id', ticketId!)
        .single();
      if (error) throw error;

      const [{ data: mensagens }, { data: midias }] = await Promise.all([
        supabase
          .from('suporte_ticket_mensagens')
          .select('*')
          .eq('ticket_id', ticketId!)
          .order('created_at', { ascending: true }),
        supabase
          .from('suporte_ticket_midias')
          .select('*')
          .eq('ticket_id', ticketId!)
          .order('created_at', { ascending: true }),
      ]);

      return { ...data, mensagens: mensagens || [], midias: midias || [] } as SuporteTicket;
    },
    enabled: !!ticketId,
  });
}

export function useCriarTicket() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile();

  return useMutation({
    mutationFn: async (payload: {
      titulo: string;
      categoria: TicketCategoria;
      prioridade: TicketPrioridade;
      descricao: string;
      arquivos: File[];
    }) => {
      const orgId = profile?.organization_id;
      if (!orgId || !user) throw new Error('Sessão inválida');

      const { data: ticket, error: ticketError } = await supabase
        .from('suporte_tickets')
        .insert({
          organization_id: orgId,
          criado_por: user.id,
          titulo: payload.titulo,
          categoria: payload.categoria,
          prioridade: payload.prioridade,
          descricao: payload.descricao,
        } as any)
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Inserir mensagem inicial (descrição como primeira mensagem)
      const nomeAutor = profile?.nome_completo || user.email || 'Cliente';
      await supabase.from('suporte_ticket_mensagens').insert({
        ticket_id: ticket.id,
        organization_id: orgId,
        autor_id: user.id,
        autor_tipo: 'cliente',
        autor_nome: nomeAutor,
        conteudo: payload.descricao,
      } as any);

      // Upload de mídias
      for (const file of payload.arquivos) {
        const ext = file.name.split('.').pop();
        const path = `${orgId}/${ticket.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('suporte-midias')
          .upload(path, file, { contentType: file.type });
        if (uploadError) continue;

        const { data: { publicUrl } } = supabase.storage.from('suporte-midias').getPublicUrl(path);
        const tipo = file.type.startsWith('video/') ? 'video' : 'image';

        await supabase.from('suporte_ticket_midias').insert({
          ticket_id: ticket.id,
          organization_id: orgId,
          nome_arquivo: file.name,
          tipo,
          mime_type: file.type,
          tamanho_bytes: file.size,
          storage_path: path,
          url_publica: publicUrl,
        } as any);
      }

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suporte_tickets'] });
      toast.success('Ticket aberto com sucesso');
    },
    onError: () => {
      toast.error('Erro ao abrir ticket');
    },
  });
}

export function useResponderTicket() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile();

  return useMutation({
    mutationFn: async ({ ticketId, conteudo, orgId }: { ticketId: string; conteudo: string; orgId: string }) => {
      const nomeAutor = profile?.nome_completo || user?.email || 'Cliente';
      const autorTipo = 'cliente';

      const { error } = await supabase.from('suporte_ticket_mensagens').insert({
        ticket_id: ticketId,
        organization_id: orgId,
        autor_id: user!.id,
        autor_tipo: autorTipo,
        autor_nome: nomeAutor,
        conteudo,
      } as any);

      if (error) throw error;

      // Reabrir se estava aguardando info
      await supabase
        .from('suporte_tickets')
        .update({ status: 'em_analise' } as any)
        .eq('id', ticketId)
        .eq('status', 'aguardando_info');
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['suporte_ticket', vars.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['suporte_tickets'] });
    },
    onError: () => {
      toast.error('Erro ao enviar mensagem');
    },
  });
}

// ── Admin-facing hooks ───────────────────────────────────────────────────────

export function useAdminTickets(filtros?: {
  status?: TicketStatus | 'todos';
  categoria?: TicketCategoria | 'todos';
  prioridade?: TicketPrioridade | 'todos';
  orgId?: string;
}) {
  return useQuery({
    queryKey: ['admin_suporte_tickets', filtros],
    queryFn: async () => {
      let q = supabase
        .from('suporte_tickets')
        .select('*, organizations(name)')
        .order('created_at', { ascending: false });

      if (filtros?.status && filtros.status !== 'todos') {
        q = q.eq('status', filtros.status);
      }
      if (filtros?.categoria && filtros.categoria !== 'todos') {
        q = q.eq('categoria', filtros.categoria);
      }
      if (filtros?.prioridade && filtros.prioridade !== 'todos') {
        q = q.eq('prioridade', filtros.prioridade);
      }
      if (filtros?.orgId) {
        q = q.eq('organization_id', filtros.orgId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useAdminTicketDetalhe(ticketId: string | null) {
  return useQuery({
    queryKey: ['admin_suporte_ticket', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suporte_tickets')
        .select('*, organizations(name)')
        .eq('id', ticketId!)
        .single();
      if (error) throw error;

      const [{ data: mensagens }, { data: midias }] = await Promise.all([
        supabase
          .from('suporte_ticket_mensagens')
          .select('*')
          .eq('ticket_id', ticketId!)
          .order('created_at', { ascending: true }),
        supabase
          .from('suporte_ticket_midias')
          .select('*')
          .eq('ticket_id', ticketId!)
          .order('created_at', { ascending: true }),
      ]);

      // Marcar como visualizado pelo admin
      supabase
        .from('suporte_tickets')
        .update({ visualizado_admin: true } as any)
        .eq('id', ticketId!)
        .then(() => {});

      return { ...data, mensagens: mensagens || [], midias: midias || [] } as any;
    },
    enabled: !!ticketId,
  });
}

export function useAdminResponderTicket() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile();

  return useMutation({
    mutationFn: async ({
      ticketId,
      orgId,
      conteudo,
      novoStatus,
    }: {
      ticketId: string;
      orgId: string;
      conteudo: string;
      novoStatus?: TicketStatus;
    }) => {
      const nomeAdmin = profile?.nome_completo || 'Equipe Descompliquei';

      const { error: msgError } = await supabase.from('suporte_ticket_mensagens').insert({
        ticket_id: ticketId,
        organization_id: orgId,
        autor_id: user!.id,
        autor_tipo: 'admin',
        autor_nome: nomeAdmin,
        conteudo,
      } as any);
      if (msgError) throw msgError;

      if (novoStatus) {
        await supabase
          .from('suporte_tickets')
          .update({ status: novoStatus } as any)
          .eq('id', ticketId);
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin_suporte_ticket', vars.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['admin_suporte_tickets'] });
      toast.success('Resposta enviada');
    },
    onError: () => {
      toast.error('Erro ao enviar resposta');
    },
  });
}

export function useAdminAtualizarStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      const { error } = await supabase
        .from('suporte_tickets')
        .update({ status } as any)
        .eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin_suporte_ticket', vars.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['admin_suporte_tickets'] });
      toast.success('Status atualizado');
    },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const CATEGORIA_LABELS: Record<TicketCategoria, string> = {
  bug: 'Bug / Erro',
  melhoria: 'Melhoria',
  duvida: 'Dúvida',
  outro: 'Outro',
};

export const PRIORIDADE_LABELS: Record<TicketPrioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  aberto: 'Aberto',
  em_analise: 'Em Análise',
  aguardando_info: 'Aguardando Info',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
};

export const PRIORIDADE_COLORS: Record<TicketPrioridade, string> = {
  baixa: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  media: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  alta: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  critica: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

export const STATUS_COLORS: Record<TicketStatus, string> = {
  aberto: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  em_analise: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  aguardando_info: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  resolvido: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  fechado: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export const CATEGORIA_COLORS: Record<TicketCategoria, string> = {
  bug: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  melhoria: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  duvida: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  outro: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};
