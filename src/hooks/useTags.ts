import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface Tag {
  id: string;
  name: string;
  color: string;
  organization_id: string;
  label_lid?: string | null;
  /** Preenchido apenas quando a tag vem de useLeadTags (data em que foi associada a este lead) */
  assigned_at?: string | null;
}

export const TAG_COLORS = [
  { name: 'slate', label: 'Cinza', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', selector: 'bg-slate-500', hex: '#64748b' },
  { name: 'red', label: 'Vermelho', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', selector: 'bg-red-500', hex: '#ef4444' },
  { name: 'orange', label: 'Laranja', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', selector: 'bg-orange-500', hex: '#f97316' },
  { name: 'amber', label: 'Amarelo', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', selector: 'bg-amber-500', hex: '#f59e0b' },
  { name: 'green', label: 'Verde', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', selector: 'bg-emerald-500', hex: '#10b981' },
  { name: 'blue', label: 'Azul', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', selector: 'bg-blue-500', hex: '#3b82f6' },
  { name: 'indigo', label: 'Índigo', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', selector: 'bg-indigo-500', hex: '#6366f1' },
  { name: 'violet', label: 'Violeta', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', selector: 'bg-violet-500', hex: '#8b5cf6' },
  { name: 'pink', label: 'Rosa', bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', selector: 'bg-pink-500', hex: '#ec4899' },
];

export function getTagColorStyles(colorValue: string) {
  const preset = TAG_COLORS.find(c => c.name === colorValue);
  if (preset) {
    return {
      className: cn(preset.bg, preset.text, preset.border, "border"),
      style: {} as React.CSSProperties
    };
  }

  if (colorValue && (colorValue.startsWith('#') || colorValue.startsWith('rgb'))) {
    return {
      className: "border",
      style: {
        backgroundColor: `${colorValue}20`,
        color: colorValue,
        borderColor: `${colorValue}40`,
      } as React.CSSProperties
    };
  }

  const defaultPreset = TAG_COLORS[0];
  return {
    className: cn(defaultPreset.bg, defaultPreset.text, defaultPreset.border, "border"),
    style: {} as React.CSSProperties
  };
}

export function useTags() {
  const { profile } = useProfile();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel('tags_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tags' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tags', orgId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);

  const { data: availableTags = [], isLoading: isLoadingTags } = useQuery({
    queryKey: ['tags', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');
      
      if (error) throw error;
      return data as Tag[];
    },
    enabled: !!orgId,
    staleTime: Infinity, // OTIMIZAÇÃO
  });

  const createTag = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!orgId) throw new Error("Organização não encontrada");
      
      const { data, error } = await supabase
        .from('tags')
        .insert({ name, color, organization_id: orgId })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', orgId] });
      toast.success("Etiqueta criada!");
    },
    onError: (err: any) => toast.error(`Erro ao criar etiqueta: ${err.message}`)
  });

  const updateTag = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      if (!orgId) throw new Error("Organização não encontrada");
      const { data, error } = await supabase
        .from('tags')
        .update({ name, color })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', orgId] });
      toast.success("Etiqueta atualizada!");
    },
    onError: (err: any) => toast.error(`Erro ao atualizar etiqueta: ${err.message}`)
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) throw new Error("Organização não encontrada");
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', orgId] });
      toast.success("Etiqueta excluída!");
    },
    onError: (err: any) => toast.error(`Erro ao excluir etiqueta: ${err.message}`)
  });

  return {
    availableTags,
    isLoadingTags,
    createTag,
    updateTag,
    deleteTag,
    refetchTags: () => queryClient.invalidateQueries({ queryKey: ['tags', orgId] }),
  };
}

export function useLeadTags(leadId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!leadId) return;

    const channel = supabase
      .channel(`lead_tags_realtime_${leadId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads_tags', filter: `lead_id=eq.${leadId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['lead_tags', leadId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, queryClient]);

  const { data: leadTags = [], isLoading } = useQuery({
    queryKey: ['lead_tags', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('leads_tags')
        .select(`
          tag_id,
          assigned_at,
          tags (
            id,
            name,
            color,
            label_lid
          )
        `)
        .eq('lead_id', leadId)
        .order('assigned_at', { ascending: true });

      if (error) throw error;

      return data.map((item: any) => ({ ...item.tags, assigned_at: item.assigned_at })) as Tag[];
    },
    enabled: !!leadId
  });

  const addTagToLead = useMutation({
    mutationFn: async (tagId: string) => {
      if (!leadId) throw new Error("Lead não definido");
      
      const { error } = await supabase
        .from('leads_tags')
        .insert({ lead_id: leadId, tag_id: tagId });
      
      if (error) throw error;

      // White-label: chama edge function para adicionar etiqueta na UAZAPI do cliente
      try {
        const { data: leadData } = await supabase.from('leads').select('telefone').eq('id', leadId).single();
        const { data: tagData } = await supabase.from('tags').select('label_lid').eq('id', tagId).single();

        if (leadData?.telefone && tagData?.label_lid) {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.functions.invoke('manage-whatsapp', {
            body: {
              action: 'add_label',
              telefone: leadData.telefone,
              label_lid: tagData.label_lid,
            },
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
        }
      } catch (err) {
        console.error("Falha ao sincronizar etiqueta com WhatsApp:", err);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_tags', leadId] });
    },
    onError: () => toast.error("Erro ao adicionar etiqueta.")
  });

  const removeTagFromLead = useMutation({
    mutationFn: async (tagId: string) => {
      if (!leadId) throw new Error("Lead não definido");
      
      try {
        const { data: leadData } = await supabase.from('leads').select('telefone').eq('id', leadId).single();
        const { data: tagData } = await supabase.from('tags').select('label_lid').eq('id', tagId).single();

        const { error } = await supabase
          .from('leads_tags')
          .delete()
          .eq('lead_id', leadId)
          .eq('tag_id', tagId);
        
        if (error) throw error;

        // White-label: chama edge function para remover etiqueta na UAZAPI do cliente
        if (leadData?.telefone && tagData?.label_lid) {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.functions.invoke('manage-whatsapp', {
            body: {
              action: 'remove_label',
              telefone: leadData.telefone,
              label_lid: tagData.label_lid,
            },
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
        }
      } catch (err: any) {
        if (err.code) throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_tags', leadId] });
    },
    onError: () => toast.error("Erro ao remover etiqueta.")
  });

  return { leadTags, isLoading, addTagToLead, removeTagFromLead };
}