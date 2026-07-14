import { useEffect } from "react";
import { Mic, Square, Trash2, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onSend: (blob: Blob) => void;
  onCancel: () => void;
}

export function AudioRecorder({ onSend, onCancel }: AudioRecorderProps) {
  const {
    isRecording,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    cancelRecording
  } = useAudioRecorder();

  // Inicia a gravação automaticamente ao montar o componente
  useEffect(() => {
    startRecording();
    return () => {
      // Limpeza de segurança
      if (isRecording) cancelRecording();
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStopAndSend = () => {
    stopRecording();
  };

  // Efeito para enviar assim que o blob estiver pronto após parar
  useEffect(() => {
    if (!isRecording && audioBlob) {
      onSend(audioBlob);
    }
  }, [isRecording, audioBlob, onSend]);

  return (
    <div className="flex items-center gap-2 flex-1 animate-in fade-in slide-in-from-bottom-2 duration-200 overflow-hidden">
      <div className="flex-1 flex items-center gap-2 sm:gap-3 bg-muted/50 rounded-full px-3 py-2 border border-destructive/20 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
        </div>
        <span className="text-sm font-display tabular-nums font-medium text-destructive flex-shrink-0">
          {formatTime(recordingTime)}
        </span>
        <span className="text-[10px] sm:text-xs text-muted-foreground ml-auto truncate opacity-70">
          Gravando...
        </span>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 w-9 rounded-full flex-shrink-0"
        onClick={() => {
          cancelRecording();
          onCancel();
        }}
      >
        <Trash2 className="h-5 w-5" />
      </Button>

      <Button
        type="button"
        size="icon"
        className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 w-9 rounded-full flex-shrink-0 shadow-sm"
        onClick={handleStopAndSend}
      >
        <Send className="h-5 w-5" />
      </Button>
    </div>
  );
}