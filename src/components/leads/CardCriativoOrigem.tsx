import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Megaphone, Instagram, Facebook, ImageOff, Loader2 } from "lucide-react";

interface CardCriativoOrigemProps {
  leadId: string;
}

interface LeadAdData {
  criativo_id: string | null;
  meta_ad_platform: string | null;
  meta_ad_title: string | null;
  meta_ad_thumbnail: string | null;
  meta_ad_source_id: string | null;
  origem: string | null;
  fonte: string | null;
  meta_ads: {
    nome: string;
    url_thumbnail: string | null;
    meta_ad_id: string;
    meta_campaigns: { nome: string } | null;
  } | null;
}

interface AdInsights {
  ctr_medio: number;
  cpl_medio: number;
}

function PlatformIcon({ platform }: { platform: string | null }) {
  if (platform === "instagram") return <Instagram className="h-4 w-4 text-pink-500" />;
  if (platform === "facebook") return <Facebook className="h-4 w-4 text-blue-600" />;
  return <Megaphone className="h-4 w-4 text-muted-foreground" />;
}

function platformLabel(platform: string | null): string {
  if (platform === "instagram") return "Instagram Ads";
  if (platform === "facebook") return "Facebook Ads";
  return "Meta Ads";
}

export function CardCriativoOrigem({ leadId }: CardCriativoOrigemProps) {
  const { data: leadAd, isLoading } = useQuery({
    queryKey: ["lead-ad-origin", leadId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("leads") as any)
        .select(`
          criativo_id,
          meta_ad_platform,
          meta_ad_title,
          meta_ad_thumbnail,
          meta_ad_source_id,
          origem,
          fonte,
          meta_ads!criativo_id (
            nome,
            url_thumbnail,
            meta_ad_id,
            meta_campaigns!meta_campaign_id (nome)
          )
        `)
        .eq("id", leadId)
        .single();
      if (error) throw error;
      return data as LeadAdData;
    },
    enabled: !!leadId,
    staleTime: 5 * 60 * 1000,
  });

  const metaAdId = leadAd?.meta_ads?.meta_ad_id || null;

  const { data: insights } = useQuery({
    queryKey: ["ad-insights-summary", metaAdId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("meta_insights") as any)
        .select("ctr, gasto, leads")
        .eq("meta_ad_id", metaAdId)
        .eq("nivel", "ad");
      if (error) throw error;
      if (!data || data.length === 0) return null;
      const totalGasto = data.reduce((s: number, r: any) => s + (r.gasto || 0), 0);
      const totalLeads = data.reduce((s: number, r: any) => s + (r.leads || 0), 0);
      const avgCtr = data.reduce((s: number, r: any) => s + (r.ctr || 0), 0) / data.length;
      return {
        ctr_medio: avgCtr,
        cpl_medio: totalLeads > 0 ? totalGasto / totalLeads : 0,
      } as AdInsights;
    },
    enabled: !!metaAdId,
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando origem...
        </div>
      </div>
    );
  }

  if (!leadAd) return null;

  const hasFullTracking = !!leadAd.criativo_id && !!leadAd.meta_ads;
  const hasPartialTracking = !leadAd.criativo_id && !!leadAd.meta_ad_source_id;
  const isMarketing = leadAd.origem === "marketing";

  // Estado 1: Lead rastreado com criativo vinculado
  if (hasFullTracking) {
    const ad = leadAd.meta_ads!;
    const campaign = (ad.meta_campaigns as any)?.nome || null;
    const thumb = ad.url_thumbnail || leadAd.meta_ad_thumbnail;
    const platform = leadAd.meta_ad_platform || leadAd.fonte;

    return (
      <div className="rounded-2xl border border-border/60 border-l-4 border-l-orange-500 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-4 pt-3.5 pb-2">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold font-display flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-orange-500" />
              Origem do Lead
            </span>
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] font-semibold">
              Meta Ads
            </Badge>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="flex gap-3">
            {thumb ? (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <img
                      src={thumb}
                      alt="Criativo"
                      className="w-20 h-20 rounded-lg object-cover border flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="left">Thumbnail do criativo</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <ImageOff className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <PlatformIcon platform={platform} />
                <span>{platformLabel(platform)}</span>
              </div>
              {campaign && (
                <p className="text-xs text-muted-foreground truncate" title={campaign}>
                  Campanha: {campaign}
                </p>
              )}
              <p className="text-xs text-foreground truncate" title={ad.nome}>
                Anuncio: {ad.nome}
              </p>
              {insights && (insights.cpl_medio > 0 || insights.ctr_medio > 0) && (
                <>
                  <div className="border-t border-dashed my-1" />
                  <p className="text-xs text-muted-foreground">
                    {insights.cpl_medio > 0 && (
                      <span>CPL medio: <strong className="text-foreground font-display tabular-nums">R${insights.cpl_medio.toFixed(2)}</strong></span>
                    )}
                    {insights.cpl_medio > 0 && insights.ctr_medio > 0 && <span> · </span>}
                    {insights.ctr_medio > 0 && (
                      <span>CTR: <strong className="text-foreground font-display tabular-nums">{insights.ctr_medio.toFixed(2)}%</strong></span>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Estado 2: Anúncio detectado mas não sincronizado
  if (hasPartialTracking) {
    const platform = leadAd.meta_ad_platform || leadAd.fonte;
    return (
      <div className="rounded-2xl border border-border/60 border-l-4 border-l-amber-400 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-4 pt-3.5 pb-2">
          <span className="text-base font-semibold font-display flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-amber-500" />
            Origem do Lead
          </span>
        </div>
        <div className="px-4 pb-4 space-y-1">
          <div className="flex items-center gap-1.5 text-sm">
            <PlatformIcon platform={platform} />
            <span>Veio de anuncio {platformLabel(platform)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Sincronize o Meta Ads para ver os detalhes do criativo
          </p>
        </div>
      </div>
    );
  }

  // Estado 3: Sem rastreamento
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-4 pt-3.5 pb-2">
        <span className="text-base font-semibold font-display flex items-center gap-2 text-muted-foreground">
          <Megaphone className="h-4 w-4" />
          Origem: {isMarketing ? "Marketing" : "Organico"}
        </span>
      </div>
      <div className="px-4 pb-4">
        <p className="text-xs text-muted-foreground">
          Criativo nao rastreado (chegou antes do rastreamento ser ativado)
        </p>
      </div>
    </div>
  );
}
