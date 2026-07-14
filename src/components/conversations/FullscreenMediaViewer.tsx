"use client";

import { X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Document, Page } from 'react-pdf';

interface FullscreenMediaViewerProps {
  mediaUrl: string;
  type: 'imagem' | 'video' | 'pdf';
  fileName?: string;
  onClose: () => void;
}

export function FullscreenMediaViewer({ mediaUrl, type, fileName, onClose }: FullscreenMediaViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 text-white animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/40 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 rounded-full">
            <X className="h-6 w-6" />
          </Button>
          <div className="flex flex-col">
            <span className="font-medium font-display text-sm sm:text-base truncate max-w-[200px] sm:max-w-md">
              {fileName || (type === 'imagem' ? 'Imagem' : type === 'video' ? 'Vídeo' : 'Documento')}
            </span>
            {type === 'pdf' && numPages && (
              <span className="text-[10px] text-zinc-400 font-display tabular-nums">Página {pageNumber} de {numPages}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {type === 'pdf' && (
            <div className="hidden sm:flex items-center gap-1 mr-4 bg-zinc-800/50 rounded-lg p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
              <span className="text-xs w-12 text-center font-display tabular-nums">{Math.round(scale * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.min(2.5, s + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
            </div>
          )}
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full" asChild>
            <a href={mediaUrl} download={fileName || 'arquivo'} target="_blank" rel="noopener noreferrer">
              <Download className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-auto scrollbar-none">
        {type === 'imagem' && (
          <img 
            src={mediaUrl} 
            alt="Visualização" 
            className="max-w-full max-h-full object-contain shadow-2xl transition-transform"
            style={{ transform: `scale(${scale})` }}
          />
        )}

        {type === 'video' && (
          <video 
            src={mediaUrl} 
            controls 
            autoPlay
            className="max-w-full max-h-full rounded-lg shadow-2xl"
          />
        )}

        {type === 'pdf' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="bg-white rounded shadow-2xl overflow-hidden">
              <Document
                file={mediaUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<div className="p-20 text-black flex flex-col items-center gap-2"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />Carregando Documento...</div>}
                error={<div className="p-20 text-red-500 flex flex-col items-center gap-2"><FileText className="h-10 w-10" />Erro ao carregar PDF</div>}
              >
                <Page 
                  pageNumber={pageNumber} 
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            </div>

            {numPages && numPages > 1 && (
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-zinc-800/90 backdrop-blur p-2 rounded-full border border-zinc-700 shadow-xl">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber(prev => prev - 1)}
                  className="rounded-full h-10 w-10"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <span className="text-sm font-medium font-display tabular-nums px-2">{pageNumber} / {numPages}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  disabled={pageNumber >= numPages}
                  onClick={() => setPageNumber(prev => prev + 1)}
                  className="rounded-full h-10 w-10"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}