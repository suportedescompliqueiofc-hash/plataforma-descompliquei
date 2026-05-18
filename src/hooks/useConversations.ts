import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { Lead } from './useLeads';
import { useProfile } from './useProfile';
import { Tag } from './useTags';

export interface Attachment {
  id: string;
  message_id: string;
  file_path: string;
  file_type: 'imagem' | 'video' | 'audio' | 'arquivo' | 'pdf';
}

export interface Message {
  id: string;
  lead_id: string;
  user_id: string | null;
  conteudo: string;
  direcao: 'entrada' | 'saida';
  remetente: 'lead' | 'agente' | 'bot' | 'agente_crm';
  tipo_conteudo: string;
  criado_em: string;
  media_path: string | null;
  id_mensagem: string | null;
  quoted_message_id: string | null;
  is_edited: boolean;
  edited_at: string | null;
  original_content: string | null;
  message_attachments?: Attachment[];
}

export interface Conversation extends Lead {
  last_message_content?: string;
  last_message_timestamp?: string;
  last_message_type?: string;
  last_message_sender?: string;
  tags: Tag[];
  em_cadencia?: boolean;
}

export function useConversationsList() {
  const { profile } = useProfile(); 
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  useEffect(() => {
    if (!orgId) return;
    
    const channel = supabase.channel('conversations-list-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, (payload) => {
        const newMessage = payload.new as Message;
        
        queryClient.setQueryData<Conversation[]>(['conversations', orgId], (old) => {
          if (!old) return old;
          
          return old.map(conv => {
            if (conv.id === newMessage.lead_id) {
              return {
                ...conv,
                last_message_content: newMessage.conteudo || 'Mídia recebida',
                last_message_timestamp: newMessage.criado_em,
                last_message_type: newMessage.tipo_conteudo,
                last_message_sender: newMessage.remetente,
              };
            }
            return conv;
          }).sort((a, b) => new Date(b.last_message_timestamp!).getTime() - new Date(a.last_message_timestamp!).getTime());
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `organization_id=eq.${orgId}` }, (payload) => {
        const updatedLead = payload.new as any;
        queryClient.setQueryData<Conversation[]>(['conversations', orgId], (old) => {
          if (!old) return old;
          return old.map(conv => {
            if (conv.id === updatedLead.id) {
              return { 
                ...conv, 
                ...updatedLead,
                last_message_content: conv.last_message_content,
                last_message_timestamp: conv.last_message_timestamp,
                last_message_type: conv.last_message_type,
                last_message_sender: conv.last_message_sender
              };
            }
            return conv;
          });
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, queryClient]);

  return useQuery<Conversation[], Error>({
    queryKey: ['conversations', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select(`
          *,
          leads_tags (
            tags (*)
          ),
          mensagens (
            conteudo,
            criado_em,
            tipo_conteudo,
            remetente
          ),
          lead_cadencias(
            status
          )
        `)
        .eq('organization_id', orgId)
        .order('criado_em', { foreignTable: 'mensagens', ascending: false })
        .limit(1, { foreignTable: 'mensagens' });

      if (leadsError) {
        console.error("Erro ao buscar conversas:", leadsError);
        throw leadsError;
      }

      const conversations = leads.map((lead: any) => {
        const lastMessage = lead.mensagens && lead.mensagens.length > 0 ? lead.mensagens[0] : null;
        const tags = lead.leads_tags?.map((lt: any) => lt.tags).filter(Boolean) || [];
        const em_cadencia = lead.lead_cadencias?.some((lc: any) => lc.status === 'ativo') || false;
        
        delete lead.mensagens;
        delete lead.leads_tags;
        delete lead.lead_cadencias;
        
        return {
          ...lead,
          last_message_content: lastMessage?.conteudo || 'Nenhuma mensagem ainda',
          last_message_timestamp: lastMessage?.criado_em || lead.criado_em,
          last_message_type: lastMessage?.tipo_conteudo || 'texto',
          last_message_sender: lastMessage?.remetente,
          tags: tags,
          em_cadencia: em_cadencia,
        };
      });

      return conversations.sort((a: any, b: any) => new Date(b.last_message_timestamp!).getTime() - new Date(a.last_message_timestamp!).getTime());
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5, 
  });
}

export function useMessages(leadId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!leadId) return;

    const channel = supabase.channel(`messages-sync-${leadId}`)
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `lead_id=eq.${leadId}` }, 
        (payload) => {
          const newMessage = payload.new as Message;
          
          queryClient.setQueryData<Message[]>(['messages', leadId], (old) => {
            const current = old || [];
            const isOutgoing = newMessage.remetente !== 'lead';
            
            if (isOutgoing) {
              const tempIndex = current.findIndex(m => {
                const isTemp = m.id.startsWith('temp');
                const isTempOutgoing = m.remetente !== 'lead' || m.direcao === 'saida';
                const isSameType = m.tipo_conteudo === newMessage.tipo_conteudo;
                
                if (newMessage.tipo_conteudo === 'texto') {
                  return isTemp && isTempOutgoing && m.conteudo === newMessage.conteudo;
                }
                return isTemp && isTempOutgoing && isSameType;
              });

              if (tempIndex !== -1) {
                const updated = [...current];
                updated[tempIndex] = { 
                  ...newMessage, 
                  message_attachments: updated[tempIndex].message_attachments 
                };
                return updated;
              }
            }

            if (current.some(m => m.id === newMessage.id)) return current;
            return [...current, newMessage];
          });
        }
      )
      .on(
        'postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'mensagens', filter: `lead_id=eq.${leadId}` }, 
        (payload) => {
          const updatedMessage = payload.new as Message;
          queryClient.setQueryData<Message[]>(['messages', leadId], (old) => {
            if (!old) return old;
            return old.map(m => m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m);
          });
        }
      )
      .on(
        'postgres_changes', 
        { event: 'DELETE', schema: 'public', table: 'mensagens', filter: `lead_id=eq.${leadId}` }, 
        (payload) => {
          queryClient.setQueryData<Message[]>(['messages', leadId], (old) => 
            (old || []).filter(m => m.id !== payload.old.id)
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_attachments' },
        (payload) => {
          const newAttachment = payload.new as Attachment;
          queryClient.setQueryData<Message[]>(['messages', leadId], (old) => {
            if (!old) return old;
            return old.map(m => {
              if (m.id === newAttachment.message_id) {
                const exists = (m.message_attachments || []).some(a => a.id === newAttachment.id);
                if (exists) return m;
                return { ...m, message_attachments: [...(m.message_attachments || []), newAttachment] };
              }
              return m;
            });
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_attachments' },
        (payload) => {
          const oldAttachment = payload.old as Attachment;
          queryClient.setQueryData<Message[]>(['messages', leadId], (old) => {
            if (!old) return old;
            return old.map(m => ({
              ...m,
              message_attachments: (m.message_attachments || []).filter(a => a.id !== oldAttachment.id)
            }));
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, queryClient]);

  return useQuery<Message[], Error>({
    queryKey: ['messages', leadId],
    queryFn: async () => {
      if (!leadId || !user) return [];
      const { data: rawMessages, error } = await supabase
        .from('mensagens')
        .select('*')
        .eq('lead_id', leadId)
        .order('criado_em', { ascending: true });
      if (error) throw error;
      
      const messageIds = rawMessages.map(m => m.id);
      
      let attachments: any[] = [];
      if (messageIds.length > 0) {
        const { data } = await supabase.from('message_attachments').select('*').in('message_id', messageIds);
        attachments = data || [];
      }
      
      return rawMessages.map(msg => ({
        ...msg,
        message_attachments: attachments?.filter(a => a.message_id === msg.id) || []
      })) as Message[];
    },
    enabled: !!leadId && !!user,
    staleTime: Infinity,
  });
}

export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, content, quotedMessageId, quotedWaMsgId, quotedParticipant }: { leadId: string; content: string; quotedMessageId?: string; quotedWaMsgId?: string; quotedParticipant?: string }) => {
      if (!user?.id) throw new Error("Usuário não autenticado");

      const { data: lead } = await supabase.from('leads').select('telefone').eq('id', leadId).single();
      if (!(lead as any)?.telefone) throw new Error("Telefone do lead não encontrado");

      const { error } = await supabase.functions.invoke('send-quick-message', {
        body: {
          lead_id: leadId,
          mensagem: content,
          tipo: 'texto',
          telefone: (lead as any).telefone,
          user_id: user.id,
          remetente: 'agente',
          skip_db: false,
          ...(quotedWaMsgId ? { quoted_msg_id: quotedWaMsgId } : {}),
          ...(quotedMessageId ? { quoted_message_id: quotedMessageId } : {}),
          ...(quotedParticipant ? { quoted_participant: quotedParticipant } : {}),
        },
      });

      if (error) {
        let errorMsg = error.message;
        try {
          const errorData = await (error as any).context?.json?.();
          if (errorData?.error) errorMsg = errorData.error;
        } catch {}
        throw new Error(errorMsg);
      }
      return { lead_id: leadId, conteudo: content };
    },
    onMutate: async ({ leadId, content, quotedMessageId }) => {
      const queryKey = ['messages', leadId];
      await queryClient.cancelQueries({ queryKey });
      const previousMessages = queryClient.getQueryData<Message[]>(queryKey);

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        lead_id: leadId,
        user_id: user?.id || null,
        conteudo: content,
        direcao: 'saida',
        remetente: 'agente',
        tipo_conteudo: 'texto',
        criado_em: new Date().toISOString(),
        media_path: null,
        id_mensagem: null,
        quoted_message_id: quotedMessageId || null,
        is_edited: false,
        edited_at: null,
        original_content: null,
        message_attachments: []
      };

      queryClient.setQueryData<Message[]>(queryKey, (old) => [...(old || []), optimisticMessage]);

      return { previousMessages };
    },
    onError: (err: any, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', variables.leadId], context.previousMessages);
      }
      toast.error(err?.message || "Erro ao enviar mensagem.");
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const orgId = profile?.organization_id;

  return useMutation({
    mutationFn: async ({ leadId, deleteLead = false }: { leadId: string; deleteLead?: boolean }) => {
      const { error } = await supabase
        .from('mensagens')
        .delete()
        .eq('lead_id', leadId);

      if (error) throw error;

      if (deleteLead) {
        await (supabase as any)
          .from('outbound_prospectos')
          .update({ whatsapp_lead_id: null })
          .eq('whatsapp_lead_id', leadId);

        const { error: leadErr } = await supabase
          .from('leads')
          .delete()
          .eq('id', leadId);
        if (leadErr) throw leadErr;
      }

      return leadId;
    },
    onSuccess: (leadId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', orgId] });
      queryClient.invalidateQueries({ queryKey: ['messages', leadId] });
      queryClient.invalidateQueries({ queryKey: ['outbound_prospectos', orgId] });
      toast.success('Conversa excluída com sucesso.');
    },
    onError: (err: any) => {
      toast.error('Erro ao excluir conversa: ' + err.message);
    }
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, leadId, id_mensagem }: { messageId: string; leadId: string; id_mensagem: string | null }) => {
      await supabase.functions.invoke('delete-message', { body: { messageId, leadId, id_mensagem } });
      return { messageId, leadId };
    },
    onSuccess: ({ leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', leadId] });
    }
  });
}

export function useEditMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, newText, leadId }: { messageId: string; newText: string; leadId: string }) => {
      const { data, error } = await supabase.functions.invoke('edit-message', {
        body: { message_id: messageId, new_text: newText, user_id: user?.id },
      });
      if (error) throw new Error(error.message || 'Erro ao editar mensagem');
      if (data?.error) throw new Error(data.error);
      return { messageId, newText, leadId };
    },
    onSuccess: ({ leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', leadId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Não foi possível editar. A janela de 15 minutos pode ter expirado.');
    }
  });
}

export function useSendAudioMessage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, audioBlob }: { leadId: string; audioBlob: Blob }) => {
      const orgId = profile?.organization_id;
      if (!orgId) throw new Error("Perfil da organização não carregado. Tente novamente.");
      const timestamp = Date.now();
      const filePath = `${orgId}/audio/${leadId}/${timestamp}.ogg`;
      
      const { error: uploadError } = await supabase.storage.from('media-mensagens').upload(filePath, audioBlob);
      if (uploadError) throw uploadError;
      
      const { data: insertedMsg, error: insertError } = await supabase
        .from('mensagens')
        .insert({
            lead_id: leadId,
            user_id: user?.id,
            conteudo: '',
            direcao: 'saida',
            remetente: 'agente',
            tipo_conteudo: 'audio',
            media_path: filePath
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      await (supabase.from('message_attachments').insert({
        message_id: insertedMsg.id,
        file_path: filePath,
        file_type: 'audio'
      } as any) as any);
      
      const { data: { publicUrl } } = supabase.storage.from('media-mensagens').getPublicUrl(filePath);
      const { data: lead } = await supabase.from('leads').select('telefone').eq('id', leadId).single();
      if (!(lead as any)?.telefone) throw new Error("Telefone do lead não encontrado");
      if (!(insertedMsg as any)?.id) throw new Error("Erro ao registrar áudio no banco");

      const { error } = await supabase.functions.invoke('send-quick-message', {
        body: {
          lead_id: leadId,
          mensagem: '',
          tipo: 'audio',
          url_midia: publicUrl,
          telefone: (lead as any).telefone,
          user_id: user?.id,
          remetente: 'agente',
          skip_db: true,
          internal_msg_id: (insertedMsg as any).id,
        },
      });

      if (error) {
        let errorMsg = error.message;
        try {
          const errorData = await (error as any).context?.json?.();
          if (errorData?.error) errorMsg = errorData.error;
        } catch {}
        throw new Error(errorMsg);
      }
      return insertedMsg;
    },
    onMutate: async ({ leadId, audioBlob }) => {
      const queryKey = ['messages', leadId];
      await queryClient.cancelQueries({ queryKey });
      const previousMessages = queryClient.getQueryData<Message[]>(queryKey);

      const optimisticMessage: Message = {
        id: `temp-audio-${Date.now()}`,
        lead_id: leadId,
        user_id: user?.id || null,
        conteudo: '',
        direcao: 'saida',
        remetente: 'agente',
        tipo_conteudo: 'audio',
        criado_em: new Date().toISOString(),
        media_path: URL.createObjectURL(audioBlob),
        id_mensagem: null,
        message_attachments: []
      };

      queryClient.setQueryData<Message[]>(queryKey, (old) => [...(old || []), optimisticMessage]);

      return { previousMessages };
    },
    onError: (err: any, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', variables.leadId], context.previousMessages);
      }
      toast.error(err?.message || "Erro ao enviar áudio.");
    }
  });
}

export function useSendMediaMessage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, file, type, caption }: { leadId: string; file: File; type: 'imagem' | 'video' | 'pdf'; caption?: string }) => {
      const orgId = profile?.organization_id;
      if (!orgId) throw new Error("Perfil da organização não carregado. Tente novamente.");
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const filePath = `${orgId}/media/${leadId}/${timestamp}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('media-mensagens').upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data: insertedMsg, error: insertError } = await supabase
        .from('mensagens')
        .insert({
            lead_id: leadId,
            user_id: user?.id,
            conteudo: caption || '',
            direcao: 'saida',
            remetente: 'agente',
            tipo_conteudo: type,
            media_path: filePath
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      await (supabase.from('message_attachments').insert({
        message_id: insertedMsg.id,
        file_path: filePath,
        file_type: type === 'pdf' ? 'pdf' : type as any
      } as any) as any);
      
      const { data: { publicUrl } } = supabase.storage.from('media-mensagens').getPublicUrl(filePath);
      const { data: lead } = await supabase.from('leads').select('telefone').eq('id', leadId).single();
      if (!(lead as any)?.telefone) throw new Error("Telefone do lead não encontrado");
      if (!(insertedMsg as any)?.id) throw new Error(`Erro ao registrar ${type} no banco`);

      const { error } = await supabase.functions.invoke('send-quick-message', {
        body: {
          lead_id: leadId,
          mensagem: caption || '',
          tipo: type,
          url_midia: publicUrl,
          telefone: (lead as any).telefone,
          user_id: user?.id,
          remetente: 'agente',
          skip_db: true,
          internal_msg_id: (insertedMsg as any).id,
        },
      });

      if (error) {
        let errorMsg = error.message;
        try {
          const errorData = await (error as any).context?.json?.();
          if (errorData?.error) errorMsg = errorData.error;
        } catch {}
        throw new Error(errorMsg);
      }
      return insertedMsg;
    },
    onMutate: async ({ leadId, file, type, caption }) => {
      const queryKey = ['messages', leadId];
      await queryClient.cancelQueries({ queryKey });
      const previousMessages = queryClient.getQueryData<Message[]>(queryKey);

      const optimisticMessage: Message = {
        id: `temp-media-${Date.now()}`,
        lead_id: leadId,
        user_id: user?.id || null,
        conteudo: caption || '',
        direcao: 'saida',
        remetente: 'agente',
        tipo_conteudo: type,
        criado_em: new Date().toISOString(),
        media_path: URL.createObjectURL(file),
        id_mensagem: null,
        message_attachments: []
      };

      queryClient.setQueryData<Message[]>(queryKey, (old) => [...(old || []), optimisticMessage]);

      return { previousMessages };
    },
    onError: (err: any, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', variables.leadId], context.previousMessages);
      }
      toast.error(err?.message || `Erro ao enviar ${variables.type}.`);
    }
  });
}