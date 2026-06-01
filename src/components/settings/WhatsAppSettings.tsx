import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Smartphone, RefreshCw, Wifi, WifiOff, QrCode, Settings2, Trash2, Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type ConnectionStatus = 'not_configured' | 'disconnected' | 'qr_pending' | 'connected';

interface WhatsAppConnection {
  id: string;
  instance_name: string;
  uazapi_url: string;
  status: ConnectionStatus;
  phone_number: string | null;
  qr_code: string | null;
  n8n_webhook_url: string | null;
  last_connected_at: string | null;
  usuario_id_default: string | null;
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; dotColor: string; bgColor: string; textColor: string; icon: React.ElementType }> = {
  not_configured: { label: 'Não configurado', dotColor: 'bg-gray-400', bgColor: 'bg-gray-50', textColor: 'text-gray-600', icon: WifiOff },
  disconnected: { label: 'Desconectado', dotColor: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700', icon: WifiOff },
  qr_pending: { label: 'Aguardando QR Code', dotColor: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700', icon: QrCode },
  connected: { label: 'Conectado', dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', icon: CheckCircle2 },
};

export function WhatsAppSettings() {
  const { toast } = useToast();
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [qrPolling, setQrPolling] = useState<ReturnType<typeof setInterval> | null>(null);
  const [statusPolling, setStatusPolling] = useState<ReturnType<typeof setInterval> | null>(null);
  const DEFAULT_UAZAPI_URL = 'https://odontonova.uazapi.com';
  const DEFAULT_WEBHOOK_URL = 'https://noncbgdczgcboronmcah.supabase.co/functions/v1/receive-message';

  const [form, setForm] = useState({
    uazapi_url: DEFAULT_UAZAPI_URL,
    uazapi_token: '',
    instance_name: '',
    n8n_webhook_url: DEFAULT_WEBHOOK_URL,
  });

  const loadConnection = async (isRetry = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('perfis').select('organization_id').eq('id', user.id).maybeSingle();
      const orgId = profile?.organization_id;
      if (!orgId) {
        if (!isRetry) setTimeout(() => loadConnection(true), 1000);
        return;
      }
      const { data, error } = await supabase.from('whatsapp_connections').select('*').eq('organization_id', orgId).maybeSingle();
      if (data) {
        const conn = data as unknown as WhatsAppConnection;
        setConnection(conn);
        setForm(f => ({
          ...f,
          uazapi_url: conn.uazapi_url || DEFAULT_UAZAPI_URL,
          instance_name: conn.instance_name || f.instance_name,
          n8n_webhook_url: conn.n8n_webhook_url || DEFAULT_WEBHOOK_URL,
        }));
      } else if (error) {
        console.warn('Sincronizando conexão...', error.message);
      }
      if (!data && !isRetry) setTimeout(() => loadConnection(true), 2000);
    } catch (err) {
      console.error('Falha ao carregar WhatsApp:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const syncStatusFromUazapi = async () => {
    const { data: latestConn } = await supabase.from('whatsapp_connections').select('*').maybeSingle();
    if (!latestConn) {
      if (!form.uazapi_url || !form.instance_name) return;
    }
    try {
      const result = await callManageWhatsApp('check_status');
      if (result?.status) {
        setConnection(prev => {
          const base = prev || (latestConn as unknown as WhatsAppConnection);
          if (!base) return null;
          return {
            ...base,
            status: result.status as ConnectionStatus,
            qr_code: result.status === 'connected' ? null : (result.qr || base.qr_code),
            phone_number: result.phone || base.phone_number
          };
        });
      }
    } catch (_e) {}
  };

  useEffect(() => {
    const init = async () => {
      await loadConnection();
      setTimeout(() => syncStatusFromUazapi(), 200);
      setTimeout(() => syncStatusFromUazapi(), 2000);
    };
    init();
    const poll = setInterval(() => syncStatusFromUazapi(), 30000);
    setStatusPolling(poll);
    return () => {
      if (qrPolling) clearInterval(qrPolling);
      if (poll) clearInterval(poll);
    };
  }, []);

  const callManageWhatsApp = async (action: string, extra?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke('manage-whatsapp', {
      body: { action, ...form, ...extra },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    return res.data;
  };

  const handleConnect = async () => {
    if (!form.uazapi_url || !form.uazapi_token || !form.instance_name) {
      toast({ title: 'Preencha todos os campos obrigatórios', description: 'URL, Token e Nome da Instância são necessários.', variant: 'destructive' });
      return;
    }
    setIsActing(true);
    if (qrPolling) { clearInterval(qrPolling); setQrPolling(null); }
    try {
      const result = await callManageWhatsApp('create_instance');
      if (result?.status === 'connected') {
        await loadConnection();
        toast({ title: 'WhatsApp já conectado!' });
        return;
      }
      if (result?.qr) {
        setConnection(prev => ({
          ...(prev || { id: '', instance_name: form.instance_name, uazapi_url: form.uazapi_url, status: 'qr_pending' as ConnectionStatus, phone_number: null, qr_code: null, n8n_webhook_url: null, last_connected_at: null, usuario_id_default: null }),
          qr_code: result.qr,
          status: 'qr_pending'
        }) as WhatsAppConnection);
      } else {
        setConnection(prev => prev ? { ...prev, status: 'qr_pending' } : null);
        toast({ title: 'Conectando...', description: 'Aguardando QR Code da UAZAPI...' });
      }
      const poll = setInterval(async () => {
        try {
          const statusResult = await callManageWhatsApp('check_status');
          if (statusResult?.status === 'connected') {
            clearInterval(poll);
            setQrPolling(null);
            setConnection(prev => prev ? { ...prev, status: 'connected', qr_code: null, phone_number: statusResult.phone || prev.phone_number } : prev);
            toast({ title: 'WhatsApp conectado!', description: `Número: ${statusResult.phone || ''}` });
            loadConnection();
            return;
          }
          if (statusResult?.qr) {
            setConnection(prev => prev ? { ...prev, qr_code: statusResult.qr, status: 'qr_pending' } : null);
          }
        } catch (_e) {}
      }, 4000);
      setQrPolling(poll);
    } catch (err: any) {
      toast({ title: 'Erro ao conectar', description: err.message, variant: 'destructive' });
    } finally {
      setIsActing(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsActing(true);
    try {
      const result = await callManageWhatsApp('check_status');
      if (result?.status === 'connected') {
        setConnection(prev => prev ? { ...prev, status: 'connected', qr_code: null, phone_number: result.phone || prev.phone_number } : prev);
      }
      await loadConnection();
      toast({ title: `Status: ${STATUS_CONFIG[result?.status as ConnectionStatus]?.label || result?.status}` });
    } finally {
      setIsActing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsActing(true);
    if (qrPolling) { clearInterval(qrPolling); setQrPolling(null); }
    try {
      await callManageWhatsApp('disconnect');
      await loadConnection();
      toast({ title: 'WhatsApp desconectado.' });
    } finally {
      setIsActing(false);
    }
  };

  const currentStatus: ConnectionStatus = (connection?.status as ConnectionStatus) || 'not_configured';
  const statusConfig = STATUS_CONFIG[currentStatus];

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Status Card */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-muted">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">WhatsApp</p>
                {connection?.phone_number && (
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">Número: {connection.phone_number}</p>
                )}
              </div>
            </div>
            <Badge variant="outline" className={cn("text-[10px] font-medium gap-1.5 border-0", statusConfig.bgColor, statusConfig.textColor)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dotColor)} />
              {statusConfig.label}
            </Badge>
          </div>
        </div>

        {/* QR Code Area */}
        {currentStatus === 'qr_pending' && (
          <div className="p-5">
            <div className="flex flex-col items-center gap-4 p-6 rounded-xl border border-border/40 bg-muted/10">
              <QrCode className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Escaneie o QR Code com seu WhatsApp</p>
              {connection?.qr_code ? (
                <img
                  src={connection.qr_code.startsWith('data:') ? connection.qr_code : `data:image/png;base64,${connection.qr_code}`}
                  alt="QR Code WhatsApp"
                  className="w-48 h-48 rounded-lg"
                />
              ) : (
                <div className="w-48 h-48 rounded-lg bg-muted/30 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground/50 animate-pulse">Aguardando conexão...</p>
              <Button
                variant="outline"
                size="sm"
                disabled={isActing}
                onClick={async () => {
                  setIsActing(true);
                  try {
                    const result = await callManageWhatsApp('check_status');
                    if (result?.qr) {
                      setConnection(prev => prev ? { ...prev, qr_code: result.qr } : null);
                      toast({ title: 'QR Code renovado!', description: 'Escaneie rapidamente antes que expire.' });
                    } else if (result?.status === 'connected') {
                      await loadConnection();
                      toast({ title: 'WhatsApp conectado!' });
                    } else {
                      toast({ title: 'Aguardando...', description: 'QR Code ainda não disponível.' });
                    }
                  } finally {
                    setIsActing(false);
                  }
                }}
                className="h-8 rounded-lg text-[11px] font-medium border-border/60 gap-1.5 px-3"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isActing && "animate-spin")} />
                Renovar QR Code
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Card */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-muted">
              <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Configuração</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Credenciais da sua conexão</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Token de Acesso *</Label>
              <Input
                type="password"
                value={form.uazapi_token}
                onChange={e => setForm({ ...form, uazapi_token: e.target.value })}
                placeholder="seu-token-secreto"
                className="h-10 text-sm rounded-lg border-border/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome da Instância *</Label>
              <Input
                value={form.instance_name}
                onChange={e => setForm({ ...form, instance_name: e.target.value })}
                placeholder="clinica-xyz"
                className="h-10 text-sm rounded-lg border-border/60"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3.5 border-t border-border/40 bg-muted/20">
          {currentStatus !== 'connected' && (
            <Button
              onClick={handleConnect}
              disabled={isActing}
              className="h-9 rounded-lg text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 px-5 gap-1.5"
            >
              {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
              {connection ? 'Reconectar' : 'Conectar WhatsApp'}
            </Button>
          )}
          {connection && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckStatus}
              disabled={isActing}
              className="h-9 rounded-lg text-xs font-medium border-border/60 gap-1.5 px-4"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isActing && "animate-spin")} />
              Verificar Status
            </Button>
          )}
          {connection && (
            <Button
              variant="outline"
              size="sm"
              disabled={isActing}
              onClick={async () => {
                setIsActing(true);
                try {
                  await callManageWhatsApp('create_instance');
                  const result = await callManageWhatsApp('configure_webhook');
                  if (result?.success) {
                    await loadConnection();
                    toast({ title: 'Configurações salvas e webhook configurado!' });
                  } else {
                    toast({ title: 'Dados salvos, mas webhook pode precisar ser reconfigurado.', variant: 'destructive' });
                  }
                } catch (e: any) {
                  toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
                } finally {
                  setIsActing(false);
                }
              }}
              className="h-9 rounded-lg text-xs font-medium border-border/60 gap-1.5 px-4"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configurar Webhook
            </Button>
          )}
          {currentStatus === 'connected' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={isActing}
              className="h-9 rounded-lg text-xs font-medium border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5 px-4"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Desconectar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
