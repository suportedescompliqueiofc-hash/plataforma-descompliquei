"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, Send, ImageIcon, Video, FileText, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface MediaPreviewModalProps {
  files: File[];
  isOpen: boolean;
  onClose: () => void;
  onSend: (filesWithCaptions: { file: File; caption: string }[]) => void;
  onAddFiles: (newFiles: File[]) => void;
}

export function MediaPreviewModal({ files, isOpen, onClose, onSend, onAddFiles }: MediaPreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [captions, setCaptions] = useState<string[]>([]);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalFiles(files);
      setCaptions(new Array(files.length).fill(""));
      setCurrentIndex(0);
    }
  }, [isOpen, files]);

  if (!isOpen || localFiles.length === 0) return null;

  const currentFile = localFiles[currentIndex];
  const isImage = currentFile.type.startsWith("image/");
  const isVideo = currentFile.type.startsWith("video/");
  const isPdf = currentFile.type === "application/pdf";

  const handleRemoveFile = (index: number) => {
    const newFiles = localFiles.filter((_, i) => i !== index);
    const newCaptions = captions.filter((_, i) => i !== index);
    
    if (newFiles.length === 0) {
      onClose();
      return;
    }

    setLocalFiles(newFiles);
    setCaptions(newCaptions);
    setCurrentIndex(Math.min(currentIndex, newFiles.length - 1));
  };

  const handleAddMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const updatedFiles = [...localFiles, ...selectedFiles];
      const updatedCaptions = [...captions, ...new Array(selectedFiles.length).fill("")];
      setLocalFiles(updatedFiles);
      setCaptions(updatedCaptions);
      onAddFiles(selectedFiles);
    }
  };

  const handleSend = () => {
    const data = localFiles.map((file, i) => ({
      file,
      caption: captions[i]
    }));
    onSend(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/40">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 rounded-full">
            <X className="h-6 w-6" />
          </Button>
          <span className="font-medium font-display">Pré-visualização</span>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {currentIndex > 0 && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute left-4 z-10 text-white/50 hover:text-white"
            onClick={() => setCurrentIndex(currentIndex - 1)}
          >
            <ChevronLeft className="h-10 w-10" />
          </Button>
        )}

        <div className="w-full h-full flex items-center justify-center max-w-4xl max-h-[60vh]">
          {isImage && (
            <img 
              src={URL.createObjectURL(currentFile)} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
            />
          )}
          {isVideo && (
            <video 
              src={URL.createObjectURL(currentFile)} 
              controls 
              className="max-w-full max-h-full rounded-lg"
            />
          )}
          {isPdf && (
            <div className="w-full h-full bg-white rounded-lg flex items-center justify-center overflow-hidden">
              <Document file={currentFile} className="flex justify-center">
                <Page pageNumber={1} width={300} renderTextLayer={false} renderAnnotationLayer={false} />
              </Document>
            </div>
          )}
          {!isImage && !isVideo && !isPdf && (
            <div className="flex flex-col items-center gap-4">
              <FileText className="h-24 w-24 text-primary opacity-50" />
              <span className="text-lg">{currentFile.name}</span>
            </div>
          )}
        </div>

        {currentIndex < localFiles.length - 1 && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-4 z-10 text-white/50 hover:text-white"
            onClick={() => setCurrentIndex(currentIndex + 1)}
          >
            <ChevronRight className="h-10 w-10" />
          </Button>
        )}
      </div>

      {/* Footer Area: Caption & Carousel */}
      <div className="bg-black/60 backdrop-blur-md p-4 sm:p-6 space-y-6">
        {/* Caption Input */}
        <div className="max-w-3xl mx-auto w-full">
          <div className="relative group">
            <Input 
              placeholder="Adicione uma legenda..." 
              value={captions[currentIndex]}
              onChange={(e) => {
                const newCaptions = [...captions];
                newCaptions[currentIndex] = e.target.value;
                setCaptions(newCaptions);
              }}
              className="bg-zinc-800/80 border-0 text-white h-12 px-4 rounded-xl focus-visible:ring-primary focus-visible:ring-offset-0"
            />
          </div>
        </div>

        {/* File Carousel */}
        <div className="flex items-center justify-center gap-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-2 px-1">
            {localFiles.map((file, index) => {
              const fileType = file.type;
              const isImg = fileType.startsWith("image/");
              const isVid = fileType.startsWith("video/");
              
              return (
                <div 
                  key={index}
                  className={cn(
                    "relative group shrink-0 w-16 h-16 rounded-lg border-2 transition-all cursor-pointer overflow-hidden",
                    currentIndex === index ? "border-primary scale-110 shadow-lg shadow-primary/20" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                  onClick={() => setCurrentIndex(index)}
                >
                  {isImg && <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" />}
                  {isVid && <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><Video className="h-6 w-6 text-white" /></div>}
                  {!isImg && !isVid && <div className="w-full h-full bg-zinc-800 flex items-center justify-center"><FileText className="h-6 w-6 text-white" /></div>}
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }}
                    className="absolute top-0 right-0 bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-lg"
                  >
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </button>
                </div>
              );
            })}

            {/* Add More Button */}
            <button 
              onClick={() => addFileInputRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-zinc-700 hover:border-zinc-500 hover:bg-white/5 flex items-center justify-center transition-all shrink-0"
            >
              <Plus className="h-6 w-6 text-zinc-500" />
            </button>
            <input 
              type="file" 
              className="hidden" 
              ref={addFileInputRef} 
              multiple 
              onChange={handleAddMoreFiles}
              accept="image/*,video/*,application/pdf"
            />
          </div>

          <Button 
            onClick={handleSend} 
            size="icon" 
            className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shrink-0"
          >
            <Send className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}