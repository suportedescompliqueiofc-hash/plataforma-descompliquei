import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Smartphone, RefreshCw, Wifi, WifiOff, QrCode, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ConnectionStatus = 'not_configured' | 'disconnected' | 'qr_pending' | 'connected';

interface WhatsAppConnection {
  id: string;
  instance_name: string;
  uazapi_url: string;
  status: ConnectionStatus;
  phone_number: string | null;
  qr_code: string | null;
  last_connected_at: string | null;
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
  not_configured: { label: 'Não configurado', dotColor: 'bg-gray-400', bgColor: 'bg-gray-50', textColor: 'text-gray-600' },
  disconnected:   { label: 'Desconectado',    dotColor: 'bg-red-500',  bgColor: 'bg-red-50',  textColor: 'text-red-700' },
  qr_pending:     { label: 'Aguardando QR',   dotColor: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  connected:      { label: 'Conectado',        dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
};

export function WhatsAppSettings() {
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const callManage = async (action: string, extra?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke('manage-whatsapp', {
      body: { action, ...extra },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };

  const loadConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('perfis').select('organization_id').eq('id', user.id).maybeSingle();
      if (!profile?.organization_id) return;
      const { data } = await supabase.from('whatsapp_connections').select('*').eq('organization_id', profile.organization_id).maybeSingle();
      if (data) setConnection(data as unknown as WhatsAppConnection);
    } finally {
      setIsLoading(false);
    }
  };

  const startStatusPolling = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const result = await callManage('check_status');
        if (result?.status === 'connected') {
          stopPolling();
          setConnection(prev => prev ? { ...prev, status: 'connected', qr_code: null, phone_number: result.phone || prev.phone_number } : prev);
          toast.success(`WhatsApp conectado! Número: ${result.phone || ''}`);
          await loadConnection();
        } else if (result?.qr) {
          setConnection(prev => prev ? { ...prev, qr_code: result.qr, status: 'qr_pending' } : prev);
        }
      } catch (_) {}
    }, 4000);
  };

  useEffect(() => {
    loadConnection().then(() => {
      // Sync status silencioso na abertura
      callManage('check_status').then(result => {
        if (result?.status) {
          setConnection(prev => prev ? {
            ...prev,
            status: result.status as ConnectionStatus,
            qr_code: result.status === 'connected' ? null : (result.qr || prev.qr_code),
            phone_number: result.phone || prev.phone_number,
          } : prev);
          if (result.status === 'qr_pending') startStatusPolling();
        }
      }).catch(() => {});
    });
    return stopPolling;
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    stopPolling();
    try {
      const result = await callManage('auto_setup');
      if (result?.status === 'connected') {
        await loadConnection();
        toast.success('WhatsApp já conectado!');
        return;
      }
      if (result?.qr) {
        setConnection(prev => ({
          ...(prev ?? { id: '', instance_name: '', uazapi_url: '', status: 'qr_pending', phone_number: null, qr_code: null, last_connected_at: null }),
          qr_code: result.qr,
          status: 'qr_pending' as ConnectionStatus,
        }));
      } else {
        setConnection(prev => prev ? { ...prev, status: 'qr_pending' } : prev);
      }
      await loadConnection();
      startStatusPolling();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar conexão.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    stopPolling();
    try {
      await callManage('disconnect');
      await loadConnection();
      setConnection(prev => prev ? { ...prev, status: 'disconnected', qr_code: null } : prev);
      toast.success('WhatsApp desconectado.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao desconectar.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefreshQr = async () => {
    try {
      const result = await callManage('check_status');
      if (result?.qr) {
        setConnection(prev => prev ? { ...prev, qr_code: result.qr } : prev);
        toast.info('QR Code renovado.');
      } else if (result?.status === 'connected') {
        stopPolling();
        await loadConnection();
        toast.success('WhatsApp conectado!');
      }
    } catch (_) {}
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-10 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status: ConnectionStatus = (connection?.status as ConnectionStatus) || 'not_configured';
  const statusCfg = STATUS_CONFIG[status];
  const isConnected = status === 'connected';
  const isQrPending = status === 'qr_pending';

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">WhatsApp</p>
              {connection?.phone_number && (
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{connection.phone_number}</p>
              )}
            </div>
          </div>
          <Badge variant="outline" className={cn('text-[10px] font-medium gap-1.5 border-0', statusCfg.bgColor, statusCfg.textColor)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dotColor)} />
            {statusCfg.label}
          </Badge>
        </div>
      </div>

      {/* QR Code */}
      {isQrPending && (
        <div className="p-6">
          <div className="flex flex-col items-center gap-4 p-6 rounded-xl border border-border/40 bg-muted/10">
            <QrCode className="h-5 w-5 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Escaneie o QR Code com seu WhatsApp</p>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">Abra o WhatsApp no celular e vá em Aparelhos Conectados</p>
            </div>
            {connection?.qr_code ? (
              <img
                src={connection.qr_code.startsWith('data:') ? connection.qr_code : `data:image/png;base64,${connection.qr_code}`}
                alt="QR Code WhatsApp"
                className="w-52 h-52 rounded-xl"
              />
            ) : (
              <div className="w-52 h-52 rounded-xl bg-muted/30 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground/40 animate-pulse">Aguardando leitura...</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshQr}
              className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
            >
              <RefreshCw className="h-3 w-3" />
              Renovar QR Code
            </Button>
          </div>
        </div>
      )}

      {/* Conectado */}
      {isConnected && (
        <div className="p-6">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200/60 bg-emerald-50/40">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">WhatsApp conectado</p>
              {connection?.phone_number && (
                <p className="text-[11px] text-emerald-700/60 mt-0.5">{connection.phone_number}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Estado inicial / desconectado */}
      {!isQrPending && !isConnected && (
        <div className="p-6">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="p-3 rounded-xl bg-muted/40">
              <WifiOff className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum WhatsApp conectado</p>
            <p className="text-[11px] text-muted-foreground/50">Clique no botão abaixo para conectar seu número</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border/40 bg-muted/20">
        {isConnected && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="h-9 rounded-lg text-xs font-medium border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5 px-4"
          >
            {isDisconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WifiOff className="h-3.5 w-3.5" />}
            Desconectar
          </Button>
        )}
        {!isConnected && !isQrPending && (
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
          >
            {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
            {isConnecting ? 'Configurando...' : 'Conectar WhatsApp'}
          </Button>
        )}
        {isQrPending && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnect}
            disabled={isConnecting}
            className="h-9 rounded-lg text-xs font-medium border-border/60 gap-1.5 px-4"
          >
            {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Reconectar
          </Button>
        )}
      </div>
    </div>
  );
}
