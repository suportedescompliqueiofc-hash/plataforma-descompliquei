import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit2, Trash2, Users, DollarSign, ImageIcon, MousePointerClick, BarChart } from "lucide-react";
import { Criativo } from "@/hooks/useMarketing";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CreativeDetailsModal } from "./CreativeDetailsModal";

interface CreativeCardProps {
  criativo: Criativo;
  onEditName: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function CreativeCard({ criativo, onEditName, onDelete }: CreativeCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const metrics = criativo.platform_metrics;
  const hasMetrics = metrics && metrics.spend > 0;

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden hover:shadow-md transition-all duration-200 group flex flex-col h-full">
        {/* Thumbnail Section */}
        <div className="relative aspect-video bg-black/5 dark:bg-white/5 flex items-center justify-center overflow-hidden cursor-pointer border-b border-border/40" onClick={() => setIsModalOpen(true)}>
          {criativo.url_thumbnail ? (
            <img 
              src={criativo.url_thumbnail} 
              alt={criativo.nome || criativo.titulo || "Criativo"} 
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
              <span className="text-xs">Sem imagem</span>
            </div>
          )}
          
          <div className="absolute top-2 right-2 flex gap-1">
            {hasMetrics && (
              <Badge variant="secondary" className="bg-blue-600 text-white hover:bg-blue-700 backdrop-blur-sm shadow-sm gap-1">
                <BarChart className="h-3 w-3" /> ADS
              </Badge>
            )}
            <Badge variant="secondary" className="bg-black/60 text-white hover:bg-black/70 backdrop-blur-sm shadow-sm">
              {criativo.aplicativo || "N/A"}
            </Badge>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-2 gap-2">
            <h3 className="font-semibold text-base line-clamp-1 font-display" title={criativo.nome || criativo.titulo || "Sem título"}>
              {criativo.nome || criativo.titulo || "Sem título"}
            </h3>
          </div>

          {hasMetrics ? (
            <div className="grid grid-cols-2 gap-2 mb-4 mt-1">
              <div className="bg-muted/30 p-2 rounded border border-border/60 text-center">
                <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Gasto</span>
                <span className="text-sm font-bold font-display tabular-nums">R$ {metrics.spend.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="bg-muted/30 p-2 rounded border border-border/60 text-center">
                <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Custo/Res.</span>
                <span className="text-sm font-bold font-display tabular-nums">R$ {metrics.cost_per_result.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="bg-muted/30 p-2 rounded border border-border/60 text-center">
                <span className="text-[10px] text-muted-foreground block uppercase font-semibold">CTR</span>
                <span className="text-sm font-bold font-display tabular-nums text-blue-600">{metrics.ctr.toFixed(2)}%</span>
              </div>
              <div className="bg-muted/30 p-2 rounded border border-border/60 text-center">
                <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Cliques</span>
                <span className="text-sm font-bold font-display tabular-nums">{metrics.clicks}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-4 min-h-[2.5em]">
              {criativo.conteudo || "Sem descrição disponível."}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 mt-auto">
            <div className="bg-primary/5 rounded p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-primary text-xs font-medium mb-0.5">
                <Users className="h-3 w-3" /> Leads (CRM)
              </div>
              <span className="text-lg font-bold text-foreground font-display tabular-nums">{criativo.stats?.contagem_leads || 0}</span>
            </div>
            <div className="bg-green-50 rounded p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-green-700 text-xs font-medium mb-0.5">
                <DollarSign className="h-3 w-3" /> Vendas
              </div>
              <span className="text-lg font-bold text-foreground font-display tabular-nums">{criativo.stats?.contagem_vendas || 0}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-muted/20 border-t border-border/40 flex justify-between items-center text-xs text-muted-foreground">
          <span>{format(new Date(criativo.criado_em), "dd/MM/yy", { locale: ptBR })}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsModalOpen(true)} title="Ver Detalhes">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsModalOpen(true)} title="Editar Nome">
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(criativo.id)} title="Excluir">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <CreativeDetailsModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        criativo={criativo} 
        onEditName={onEditName}
      />
    </>
  );
}