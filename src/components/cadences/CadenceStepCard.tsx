import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Clock, Upload, Plus, X, MessageSquare, Mic, Image as ImageIcon, Video, FileText, CheckCircle2, FileCheck } from "lucide-react";
import { CadenceStep } from "@/hooks/useCadences";
import { useRef } from "react";
import { cn } from "@/lib/utils";

interface CadenceStepCardProps {
  step: CadenceStep;
  isLast: boolean;
  onUpdate: (updates: Partial<CadenceStep>) => void;
  onDelete: () => void;
}

const TYPE_CONFIG: Record<string, { icon: typeof MessageSquare; label: string; accent: string }> = {
  texto:  { icon: MessageSquare, label: "Texto",  accent: "bg-blue-50 text-blue-600 border-blue-200/60" },
  audio:  { icon: Mic,           label: "Audio",  accent: "bg-violet-50 text-violet-600 border-violet-200/60" },
  imagem: { icon: ImageIcon,     label: "Imagem", accent: "bg-emerald-50 text-emerald-600 border-emerald-200/60" },
  video:  { icon: Video,         label: "Video",  accent: "bg-amber-50 text-amber-600 border-amber-200/60" },
  pdf:    { icon: FileText,      label: "PDF",    accent: "bg-red-50 text-red-600 border-red-200/60" },
};

export function CadenceStepCard({ step, isLast, onUpdate, onDelete }: CadenceStepCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typeInfo = TYPE_CONFIG[step.tipo_mensagem] || TYPE_CONFIG.texto;

  return (
    <div className="relative group/step animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Step number badge */}
      <div className="absolute -left-3 top-4 z-10">
        <div className="h-7 w-7 rounded-lg bg-foreground text-background flex items-center justify-center text-[10px] font-bold font-display tabular-nums shadow-sm">
          {step.posicao_ordem}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-200 hover:border-border hover:shadow-md ml-2">
        {/* Step header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-muted/[0.03]">
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border", typeInfo.accent)}>
              <typeInfo.icon className="h-2.5 w-2.5" />
              {typeInfo.label}
            </span>
            <span className="text-[10px] text-muted-foreground/50 font-display tabular-nums">
              Passo {step.posicao_ordem}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover/step:opacity-100"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tempo + Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tempo de espera */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Tempo de Espera
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={step.tempo_espera}
                  onChange={e => onUpdate({ tempo_espera: parseInt(e.target.value) || 1 })}
                  className="w-20 h-10 text-sm rounded-lg border-border/60 font-display tabular-nums"
                />
                <Select value={step.unidade_tempo} onValueChange={v => onUpdate({ unidade_tempo: v as any })}>
                  <SelectTrigger className="flex-1 h-10 text-sm rounded-lg border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60">
                    <SelectItem value="minutos">Minutos</SelectItem>
                    <SelectItem value="horas">Horas</SelectItem>
                    <SelectItem value="dias">Dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground/50 font-display tabular-nums">
                {step.tempo_espera} {step.unidade_tempo} após o passo anterior
              </p>
            </div>

            {/* Tipo de mensagem */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tipo de Mensagem
              </Label>
              <Select value={step.tipo_mensagem} onValueChange={v => onUpdate({ tipo_mensagem: v as any, temp_file: null, arquivo_path: null })}>
                <SelectTrigger className="h-10 text-sm rounded-lg border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60">
                  <SelectItem value="texto"><div className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /> Texto</div></SelectItem>
                  <SelectItem value="audio"><div className="flex items-center gap-2"><Mic className="h-3.5 w-3.5 text-muted-foreground" /> Audio</div></SelectItem>
                  <SelectItem value="imagem"><div className="flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> Imagem</div></SelectItem>
                  <SelectItem value="video"><div className="flex items-center gap-2"><Video className="h-3.5 w-3.5 text-muted-foreground" /> Video</div></SelectItem>
                  <SelectItem value="pdf"><div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" /> PDF</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File upload (non-text types) */}
          {step.tipo_mensagem !== 'texto' && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Arquivo</Label>
              <div
                className="border-2 border-dashed border-border/60 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 hover:border-border transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {step.temp_file ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="truncate max-w-[200px]">{step.temp_file.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpdate({ temp_file: null }); }}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : step.arquivo_path ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
                    <FileCheck className="h-4 w-4" />
                    <span>Arquivo salvo</span>
                    <span className="text-[9px] opacity-60 truncate max-w-[150px]">({step.arquivo_path.split('/').pop()})</span>
                  </div>
                ) : (
                  <>
                    <div className="p-2.5 rounded-xl bg-muted/50 mb-2">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">Clique para anexar mídia</span>
                  </>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                onChange={e => onUpdate({ temp_file: e.target.files?.[0] })}
                accept={
                  step.tipo_mensagem === 'imagem' ? 'image/*' :
                  step.tipo_mensagem === 'audio' ? 'audio/*' :
                  step.tipo_mensagem === 'video' ? 'video/*' :
                  step.tipo_mensagem === 'pdf' ? 'application/pdf' : '*'
                }
              />
            </div>
          )}

          {/* Content textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {step.tipo_mensagem === 'texto' ? 'Mensagem' : 'Legenda'}
                {step.tipo_mensagem === 'texto' && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <button
                type="button"
                className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded-md hover:bg-muted/50"
                onClick={() => onUpdate({ conteudo: (step.conteudo || "") + "{{nome_lead}}" })}
              >
                <Plus className="h-2.5 w-2.5" /> {"{{nome_lead}}"}
              </button>
            </div>
            <Textarea
              placeholder="Digite a mensagem..."
              value={step.conteudo || ""}
              onChange={e => onUpdate({ conteudo: e.target.value })}
              className="text-sm min-h-[80px] rounded-lg border-border/60 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
