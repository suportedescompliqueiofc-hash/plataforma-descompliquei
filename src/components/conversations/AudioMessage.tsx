import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSignedMediaUrl } from '@/lib/media-url';
import { AudioPlayer } from './AudioPlayer';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AudioMessageProps {
  filePath: string;
  variant?: 'incoming' | 'outgoing';
}

export function AudioMessage({ filePath, variant = 'incoming' }: AudioMessageProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudio = async () => {
    if (!filePath) {
      setIsLoading(false);
      setError("Caminho inválido");
      return;
    }

    // Se já for uma URL (Blob local ou Link direto), usa imediatamente
    if (filePath.startsWith('blob:') || filePath.startsWith('http')) {
      setAudioUrl(filePath);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // URL assinada via helper com cache (a URL vale 24h — ver src/lib/media-url.ts)
      const signedUrl = await getSignedMediaUrl(filePath, 'audio');
      const data = signedUrl ? { signedUrl } : null;

      if (!data?.signedUrl) {
        // Fallback para buscar no bucket principal caso a função falhe
        const { data: fallbackData } = supabase.storage.from('audio-mensagens').getPublicUrl(filePath);
        if (fallbackData?.publicUrl) {
            setAudioUrl(fallbackData.publicUrl);
        } else {
            throw new Error("Não foi possível gerar a URL do áudio");
        }
      } else {
        setAudioUrl(data.signedUrl);
      }
    } catch (err: any) {
      console.error("Erro ao carregar áudio:", err);
      setError("Indisponível");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAudio();
  }, [filePath]);

  if (isLoading) {
    return (
      <div className={cn("w-64 h-14 rounded-xl flex items-center px-3 gap-3", variant === 'outgoing' ? "bg-white/10" : "bg-muted/50")}>
        <Skeleton className={cn("h-9 w-9 rounded-full shrink-0", variant === 'outgoing' ? "bg-white/20" : "bg-muted-foreground/20")} />
        <div className="flex-1 space-y-2">
            <Skeleton className={cn("h-1.5 w-full rounded", variant === 'outgoing' ? "bg-white/20" : "bg-muted-foreground/20")} />
            <Skeleton className={cn("h-1.5 w-2/3 rounded", variant === 'outgoing' ? "bg-white/20" : "bg-muted-foreground/20")} />
        </div>
      </div>
    );
  }

  if (error || !audioUrl) {
    return (
      <div className={cn(
        "flex flex-col gap-2 p-3 w-64 rounded-xl border border-dashed min-h-[60px] justify-center", 
        variant === 'outgoing' ? "bg-white/10 text-white/70 border-white/30" : "bg-destructive/5 text-destructive border-destructive/20"
      )}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <AlertCircle className="h-4 w-4" />
            <span>{error || "Áudio não encontrado"}</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 hover:bg-black/10 rounded-full" 
            onClick={fetchAudio}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return <AudioPlayer audioUrl={audioUrl} variant={variant} />;
}