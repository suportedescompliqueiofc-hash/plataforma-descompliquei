import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from './useProfile';

export type WaStatus = 'connected' | 'disconnected' | 'qr_pending' | 'not_configured' | null;

export function useWhatsAppMonitor() {
  const { profile } = useProfile();
  const [status, setStatus] = useState<WaStatus>(null);
  const prevStatusRef = useRef<WaStatus>(null);

  const handleStatus = (newStatus: WaStatus) => {
    setStatus(newStatus);
    prevStatusRef.current = newStatus;
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
        handleStatus(s);
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
    };
  }, [profile?.organization_id]);

  return { status };
}
