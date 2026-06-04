import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, RefreshCw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaMessageProps {
  path: string | null;
  type: 'imagem' | 'video';
  onView?: (url: string, type: 'imagem' | 'video') => void;
}

export function MediaMessage({ path, type, onView }: MediaMessageProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMedia = async () => {
    if (!path) {
      setIsLoading(false);
      setError("Caminho não fornecido.");
      return;
    }

    // URL direta (UAZAPI link ou blob) — usa sem passar pela Edge Function
    if (path.startsWith('blob:') || path.startsWith('http')) {
      setMediaUrl(path);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('get-media-url', {
        body: { mediaPath: path, mediaType: type },
      });

      if (functionError) throw new Error(functionError.message || "Erro na Edge Function");
      if (data.error) throw new Error(data.error);
      if (!data.signedUrl) throw new Error("URL não retornada.");

      setMediaUrl(data.signedUrl);

    } catch (err: any) {
      console.error("Erro ao carregar mídia:", err);
      setError(err.message || "Erro ao buscar mídia");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [path]);

  if (isLoading) {
    return <Skeleton className="w-64 h-48 rounded-xl mt-1 bg-muted/40 animate-pulse" />;
  }

  if (error || !mediaUrl) {
    return (
      <div className="flex flex-col items-start p-3 mt-1 border border-destructive/20 bg-destructive/5 rounded-xl text-xs text-destructive gap-2 w-full max-w-[260px]">
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                <span>Erro na mídia</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-destructive/10" onClick={loadMedia}>
                <RefreshCw className="h-3 w-3" />
            </Button>
        </div>
        <p className="opacity-80 leading-tight">{error}</p>
        <span className="text-[9px] opacity-50 font-mono break-all line-clamp-1">{path}</span>
      </div>
    );
  }

  const handleView = (e: React.MouseEvent) => {
    if (onView && mediaUrl) {
      e.preventDefault();
      onView(mediaUrl, type);
    }
  };

  if (type === 'imagem') {
    return (
      <div className="relative group mt-1 max-w-[300px]">
        <div 
          onClick={handleView}
          className="block relative rounded-xl overflow-hidden border border-border/40 shadow-sm transition-all hover:brightness-95 cursor-pointer"
        >
          <img 
            src={mediaUrl} 
            alt="Mídia da conversa" 
            className="w-full h-auto max-h-[400px] object-cover bg-muted/20"
            onError={() => setError("Falha ao renderizar imagem.")}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all">
            <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="mt-1 max-w-[300px] relative group">
        <video 
          src={mediaUrl} 
          className="w-full rounded-xl border border-border/40 shadow-sm max-h-[400px] bg-black cursor-pointer"
          onClick={handleView}
          onError={() => setError("Falha ao renderizar vídeo.")}
        />
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:bg-black/20 transition-all rounded-xl"
        >
          <Eye className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    );
  }

  return null;
}