import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSignedMediaUrl } from '@/lib/media-url';
import { FileText, Download, Loader2, AlertTriangle, FileType } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Document, Page, pdfjs } from 'react-pdf';
import { Skeleton } from '@/components/ui/skeleton';

// Configuração obrigatória do worker do PDF.js para funcionar com Vite/React
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FileMessageProps {
  path: string;
  fileName?: string;
  onView?: (url: string, type: 'pdf', name: string) => void;
}

export function FileMessage({ path, fileName = "Documento", onView }: FileMessageProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(true);

  useEffect(() => {
    if (!path) {
      setIsLoadingUrl(false);
      setError("Caminho do arquivo não fornecido.");
      return;
    }

    // Se for um blob local (estado otimista) ou uma URL direta, usa imediatamente
    if (path.startsWith('blob:') || path.startsWith('http')) {
      setFileUrl(path);
      setIsLoadingUrl(false);
      setError(null);
      return;
    }

    const loadFile = async () => {
      setIsLoadingUrl(true);
      setError(null);

      try {
        // Helper com cache — a URL assinada vale 24h (src/lib/media-url.ts)
        const signedUrl = await getSignedMediaUrl(path, 'document');
        if (!signedUrl) throw new Error("URL não retornada.");

        setFileUrl(signedUrl);

      } catch (err: any) {
        console.error("Erro ao carregar arquivo:", err);
        setError("Não foi possível carregar o arquivo.");
      } finally {
        setIsLoadingUrl(false);
      }
    };

    loadFile();
  }, [path]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsPdfLoading(false);
  };

  const isPdf = fileName.toLowerCase().endsWith('.pdf') || (fileUrl && fileUrl.toLowerCase().includes('.pdf')) || (path && path.toLowerCase().includes('pdf'));

  const handleView = (e: React.MouseEvent) => {
    if (onView && fileUrl) {
      e.preventDefault();
      onView(fileUrl, 'pdf', fileName);
    }
  };

  if (isLoadingUrl) {
    return (
      <div className="w-full max-w-[240px] h-40 bg-muted/30 rounded-lg border flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (error || !fileUrl) {
    return (
      <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20 w-full max-w-[240px]">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="text-[10px] text-destructive">{error || "Erro ao carregar"}</span>
      </div>
    );
  }

  return (
    <div className="group relative w-full max-w-[240px] overflow-hidden rounded-lg border bg-background shadow-sm hover:shadow-md transition-all">
      <div 
        className="relative bg-gray-100 min-h-[140px] flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={handleView}
      >
        {isPdfLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-50">
            <Skeleton className="w-full h-full" />
            <Loader2 className="absolute h-8 w-8 animate-spin text-primary/30" />
          </div>
        )}
        
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<Skeleton className="w-full h-[140px]" />}
          className="flex justify-center"
          error={
            <div className="flex flex-col items-center justify-center h-[140px] text-muted-foreground p-4 text-center">
              <FileText className="h-8 w-8 mb-2 opacity-20" />
              <span className="text-[10px]">Indisponível</span>
            </div>
          }
        >
          <Page 
            pageNumber={1} 
            width={240}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="opacity-90 hover:opacity-100 transition-opacity"
          />
        </Document>
      </div>

      <div className="flex items-center justify-between p-2 bg-card border-t bg-white/95 dark:bg-zinc-900/95 backdrop-blur">
        <div 
          className="flex items-center gap-2 overflow-hidden cursor-pointer flex-1"
          onClick={handleView}
        >
          <div className="bg-red-100 dark:bg-red-900/30 p-1.5 rounded-md text-red-600 dark:text-red-400 shrink-0">
            <FileType className="h-4 w-4" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-medium truncate text-foreground leading-tight" title={fileName}>
              {fileName}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {numPages ? `${numPages} pág • ` : ''}PDF
            </span>
          </div>
        </div>
        
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary shrink-0" asChild>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" download title="Baixar PDF">
            <Download className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}