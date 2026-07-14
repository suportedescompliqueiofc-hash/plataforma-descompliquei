import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Save, Users, DollarSign, Target, Calendar, TrendingUp, CreditCard, BarChart2, MousePointerClick, Eye } from "lucide-react";
import { Criativo } from "@/hooks/useMarketing";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CreativeDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criativo: Criativo;
  onEditName: (id: string, name: string) => void;
}

export function CreativeDetailsModal({ open, onOpenChange, criativo, onEditName }: CreativeDetailsModalProps) {
  const [nomePersonalizado, setNomePersonalizado] = useState("");

  useEffect(() => {
    if (open) {
      setNomePersonalizado(criativo.nome || "");
    }
  }, [open, criativo]);

  const handleSave = () => {
    onEditName(criativo.id, nomePersonalizado);
  };

  const stats = criativo.stats || { contagem_leads: 0, contagem_vendas: 0, faturamento: 0 };
  const metaMetrics = criativo.platform_metrics;
  
  const taxaConversao = stats.contagem_leads > 0 
    ? ((stats.contagem_vendas / stats.contagem_leads) * 100).toFixed(1) 
    : "0.0";
    
  const ticketMedio = stats.contagem_vendas > 0 
    ? stats.faturamento / stats.contagem_vendas 
    : 0;

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  const formatMoney = (value: number) => value.toFixed(2).replace('.', ',');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            Detalhes do Conjunto
            {criativo.plataforma && <Badge variant="outline" className="capitalize font-normal">{criativo.plataforma}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Header Image & Basic Info */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="relative rounded-lg overflow-hidden border bg-muted aspect-video bg-black/5 flex items-center justify-center">
              {criativo.url_thumbnail ? (
                <img 
                  src={criativo.url_thumbnail} 
                  alt="Thumbnail" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-muted-foreground flex flex-col items-center">
                  <span className="text-sm">Sem pré-visualização</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome de Identificação</Label>
                <div className="flex gap-2">
                  <Input 
                    id="name" 
                    value={nomePersonalizado} 
                    onChange={(e) => setNomePersonalizado(e.target.value)} 
                    placeholder="Ex: Vídeo Depoimento - Julho"
                    className="flex-1"
                  />
                  <Button onClick={handleSave} size="icon" variant="outline"><Save className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">Defina um nome fácil para identificar este criativo nos relatórios.</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Título Original (Meta)</Label>
                <div className="text-sm font-medium border p-2.5 rounded-md bg-muted/20 min-h-[2.5rem] flex items-center">
                  <span className="line-clamp-2" title={criativo.titulo || ""}>{criativo.titulo || "N/A"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2">
                <div>
                  <span className="block font-semibold mb-1">Origem</span>
                  <Badge variant="secondary" className="capitalize bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                    {criativo.aplicativo || "Desconhecido"}
                  </Badge>
                </div>
                <div>
                  <span className="block font-semibold mb-1">Data de Criação</span>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 opacity-70" /> 
                    {format(new Date(criativo.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Seção de Métricas do Meta */}
          {metaMetrics && metaMetrics.spend > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="font-semibold text-sm flex items-center gap-2 text-blue-600 font-display">
                <BarChart2 className="h-4 w-4" /> Métricas da Plataforma (Meta Ads)
              </h4>
              <div className="bg-blue-50/50 p-5 rounded-lg border border-blue-100">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Valor Usado</span>
                    <div className="text-xl font-bold text-foreground font-display tabular-nums">R$ {formatMoney(metaMetrics.spend)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Impressões</span>
                    <div className="text-xl font-bold text-foreground flex items-center gap-2 font-display tabular-nums">
                      {metaMetrics.impressions.toLocaleString('pt-BR')}
                      <Eye className="h-4 w-4 text-muted-foreground opacity-40" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Cliques (Link)</span>
                    <div className="text-xl font-bold text-foreground flex items-center gap-2 font-display tabular-nums">
                      {metaMetrics.clicks.toLocaleString('pt-BR')}
                      <MousePointerClick className="h-4 w-4 text-muted-foreground opacity-40" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">CTR</span>
                    <div className="text-xl font-bold text-blue-600 font-display tabular-nums">{metaMetrics.ctr.toFixed(2)}%</div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">CPC (Custo/Clique)</span>
                    <div className="text-lg font-medium text-foreground/90 font-display tabular-nums">R$ {formatMoney(metaMetrics.cpc)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Alcance</span>
                    <div className="text-lg font-medium text-foreground/90 font-display tabular-nums">{metaMetrics.reach.toLocaleString('pt-BR')}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Resultados</span>
                    <div className="text-lg font-medium text-foreground/90 font-display tabular-nums">{metaMetrics.results}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Custo/Resultado</span>
                    <div className="text-lg font-bold text-amber-600 font-display tabular-nums">R$ {formatMoney(metaMetrics.cost_per_result)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <Separator className="my-1" />

          {/* Stats Section (CRM) */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground/80 font-display">
              <TrendingUp className="h-4 w-4 text-primary" /> Performance CRM (Interno)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Card Leads */}
              <div className="border rounded-lg p-5 bg-card flex flex-col justify-between hover:border-primary/30 transition-colors shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <Users className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Leads</span>
                </div>
                <div>
                  <span className="text-3xl font-bold text-foreground block font-display tabular-nums">{stats.contagem_leads}</span>
                  <span className="text-[10px] text-muted-foreground">Total captado</span>
                </div>
              </div>

              {/* Card Vendas */}
              <div className="border rounded-lg p-5 bg-card flex flex-col justify-between hover:border-green-500/30 transition-colors shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <Target className="h-4 w-4 text-green-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Vendas</span>
                </div>
                <div>
                  <span className="text-3xl font-bold text-foreground block font-display tabular-nums">{stats.contagem_vendas}</span>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-green-50 text-green-700 hover:bg-green-100 font-medium">
                      {taxaConversao}% conv.
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Card Faturamento */}
              <div className="border rounded-lg p-5 bg-card flex flex-col justify-between hover:border-primary/30 transition-colors shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Faturamento</span>
                </div>
                <div>
                  <span className="text-3xl font-bold text-foreground tracking-tight block font-display tabular-nums">{formatCurrency(stats.faturamento)}</span>
                  <span className="text-[10px] text-muted-foreground">Total gerado</span>
                </div>
              </div>

              {/* Card Ticket Médio */}
              <div className="border rounded-lg p-5 bg-card flex flex-col justify-between hover:border-blue-500/30 transition-colors shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Ticket Médio</span>
                </div>
                <div>
                  <span className="text-3xl font-bold text-foreground tracking-tight block font-display tabular-nums">{formatCurrency(ticketMedio)}</span>
                  <span className="text-[10px] text-muted-foreground">Por venda</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ad Content (Copy) */}
          {criativo.conteudo && (
            <div className="space-y-2 pt-2">
              <Label className="text-xs text-muted-foreground">Texto do Anúncio (Copy)</Label>
              <div className="bg-muted/30 p-4 rounded-lg text-sm whitespace-pre-wrap border max-h-40 overflow-y-auto font-mono text-xs text-muted-foreground">
                {criativo.conteudo}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between border-t pt-4">
          {criativo.url_midia ? (
            <Button variant="outline" asChild className="w-full sm:w-auto h-9 text-xs">
              <a href={criativo.url_midia} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Ver Anúncio Original
              </a>
            </Button>
          ) : <div />}
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-medium">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}