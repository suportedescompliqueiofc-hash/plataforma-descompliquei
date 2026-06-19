import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProfile } from './useProfile';

export type WaStatus = 'connected' | 'disconnected' | 'qr_pending' | 'not_configured' | null;

const DISCONNECT_TOAST_ID = 'wa-disconnected-alert';

export function useWhatsAppMonitor() {
  const { profile } = useProfile();
  const [status, setStatus] = useState<WaStatus>(null);
  const prevStatusRef = useRef<WaStatus>(null);

  const handleStatus = (newStatus: WaStatus) => {
    setStatus(newStatus);
    const prev = prevStatusRef.current;
    prevStatusRef.current = newStatus;

    if (newStatus === 'disconnected' && prev === 'connected') {
      toast.error('WhatsApp desconectado', {
        id: DISCONNECT_TOAST_ID,
        description: 'Sua conexão com o WhatsApp caiu. Acesse Configurações para reconectar.',
        duration: Infinity,
        action: {
          label: 'Reconectar',
          onClick: () => { window.location.href = '/crm/settings?section=whatsapp'; },
        },
      });
    }

    if (newStatus === 'connected') {
      toast.dismiss(DISCONNECT_TOAST_ID);
    }
  };

  useEffect(() => {
    const orgId = profile?.organization_id;
    if (!orgId) return;

    // Carga inicial
    supabase
      .from('whatsapp_connections')
      .select('status')
      .eq('organization_id', orgId)
      .maybeSingle()
      .then(({ data }) => {
        const s = (data?.status as WaStatus) ?? 'not_configured';
        setStatus(s);
        prevStatusRef.current = s;
        // Se já estava desconectado ao carregar, mostra alerta
        if (s === 'disconnected') {
          toast.error('WhatsApp desconectado', {
            id: DISCONNECT_TOAST_ID,
            description: 'Sua conexão com o WhatsApp está inativa. Acesse Configurações para reconectar.',
            duration: Infinity,
            action: {
              label: 'Reconectar',
              onClick: () => { window.location.href = '/crm/settings?section=whatsapp'; },
            },
          });
        }
      });

    // Realtime — reage instantaneamente a mudanças de status
    const channel = supabase
      .channel(`wa-monitor-${orgId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_connections', filter: `organization_id=eq.${orgId}` },
        (payload) => { handleStatus(payload.new?.status as WaStatus); }
      )
      .subscribe();

    // Polling a cada 5 min como fallback
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('whatsapp_connections')
        .select('status')
        .eq('organization_id', orgId)
        .maybeSingle();
      if (data?.status) handleStatus(data.status as WaStatus);
    }, 5 * 60 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      toast.dismiss(DISCONNECT_TOAST_ID);
    };
  }, [profile?.organization_id]);

  return { status };
}
