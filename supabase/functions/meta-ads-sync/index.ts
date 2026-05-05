import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const META_API_VERSION = "v19.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

interface SyncCounts {
  campaigns: number;
  adsets: number;
  ads: number;
  insights: number;
}

async function fetchAllPages(url: string, accessToken: string): Promise<any[]> {
  const results: any[] = [];
  let nextUrl: string | null = `${url}&access_token=${accessToken}`;
  let page = 0;

  while (nextUrl) {
    page++;
    console.log(`[meta-ads-sync] Fetching page ${page}: ${nextUrl.replace(accessToken, 'TOKEN_HIDDEN')}`);

    const res = await fetch(nextUrl);
    const body = await res.text();

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errJson = JSON.parse(body);
        errMsg = `Meta API error (${res.status}): ${errJson.error?.message || errJson.error?.type || body}`;
      } catch { /* keep raw message */ }
      console.error(`[meta-ads-sync] API fetch failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    const json = JSON.parse(body);
    const count = json.data?.length || 0;
    console.log(`[meta-ads-sync] Page ${page} returned ${count} records`);

    if (json.data) results.push(...json.data);
    nextUrl = json.paging?.next || null;
  }

  return results;
}

async function syncCampaigns(
  supabase: any,
  adAccountId: string,
  accessToken: string,
  organizationId: string
): Promise<number> {
  console.log(`[meta-ads-sync][campaigns] Fetching campaigns for ${adAccountId}...`);
  const url = `${META_BASE_URL}/${adAccountId}/campaigns?fields=id,name,status,objective,spend_cap,start_time,stop_time&limit=100`;
  const campaigns = await fetchAllPages(url, accessToken);
  console.log(`[meta-ads-sync][campaigns] Total fetched: ${campaigns.length}`);

  if (campaigns.length === 0) return 0;

  const rows = campaigns.map((c: any) => ({
    organization_id: organizationId,
    meta_campaign_id: c.id,
    nome: c.name,
    status: c.status,
    objetivo: c.objective || null,
    limite_gasto: c.spend_cap ? parseFloat(c.spend_cap) / 100 : null,
    data_inicio: c.start_time ? c.start_time.substring(0, 10) : null,
    data_fim: c.stop_time ? c.stop_time.substring(0, 10) : null,
    atualizado_em: new Date().toISOString(),
  }));

  console.log(`[meta-ads-sync][campaigns] Upserting ${rows.length} rows...`);
  const { error, count } = await supabase.from("meta_campaigns").upsert(rows, {
    onConflict: "meta_campaign_id",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error(`[meta-ads-sync][campaigns] Upsert FAILED: ${JSON.stringify(error)}`);
    throw new Error(`Upsert campaigns error: ${error.message} (code: ${error.code})`);
  }
  console.log(`[meta-ads-sync][campaigns] Upsert OK, ${rows.length} rows processed`);
  return rows.length;
}

async function syncAdsets(
  supabase: any,
  adAccountId: string,
  accessToken: string,
  organizationId: string
): Promise<number> {
  console.log(`[meta-ads-sync][adsets] Fetching adsets for ${adAccountId}...`);
  const url = `${META_BASE_URL}/${adAccountId}/adsets?fields=id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event&limit=100`;
  const adsets = await fetchAllPages(url, accessToken);
  console.log(`[meta-ads-sync][adsets] Total fetched: ${adsets.length}`);

  if (adsets.length === 0) return 0;

  const rows = adsets.map((a: any) => ({
    organization_id: organizationId,
    meta_adset_id: a.id,
    meta_campaign_id: a.campaign_id,
    nome: a.name,
    status: a.status,
    budget_diario: a.daily_budget ? parseFloat(a.daily_budget) / 100 : null,
    budget_total: a.lifetime_budget ? parseFloat(a.lifetime_budget) / 100 : null,
    targeting: a.targeting || null,
    optimization_goal: a.optimization_goal || null,
    billing_event: a.billing_event || null,
    atualizado_em: new Date().toISOString(),
  }));

  console.log(`[meta-ads-sync][adsets] Upserting ${rows.length} rows...`);
  const { error } = await supabase.from("meta_adsets").upsert(rows, {
    onConflict: "meta_adset_id",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error(`[meta-ads-sync][adsets] Upsert FAILED: ${JSON.stringify(error)}`);
    throw new Error(`Upsert adsets error: ${error.message} (code: ${error.code})`);
  }
  console.log(`[meta-ads-sync][adsets] Upsert OK, ${rows.length} rows processed`);
  return rows.length;
}

async function syncAds(
  supabase: any,
  adAccountId: string,
  accessToken: string,
  organizationId: string
): Promise<number> {
  console.log(`[meta-ads-sync][ads] Fetching ads for ${adAccountId}...`);
  const url = `${META_BASE_URL}/${adAccountId}/ads?fields=id,name,status,adset_id,campaign_id,creative{thumbnail_url}&limit=100`;
  const ads = await fetchAllPages(url, accessToken);
  console.log(`[meta-ads-sync][ads] Total fetched: ${ads.length}`);

  if (ads.length === 0) return 0;

  const rows = ads.map((a: any) => ({
    organization_id: organizationId,
    meta_ad_id: a.id,
    meta_adset_id: a.adset_id,
    meta_campaign_id: a.campaign_id,
    nome: a.name,
    status: a.status,
    url_thumbnail: a.creative?.thumbnail_url || null,
    atualizado_em: new Date().toISOString(),
  }));

  console.log(`[meta-ads-sync][ads] Upserting ${rows.length} rows...`);
  const { error } = await supabase.from("meta_ads").upsert(rows, {
    onConflict: "meta_ad_id",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error(`[meta-ads-sync][ads] Upsert FAILED: ${JSON.stringify(error)}`);
    throw new Error(`Upsert ads error: ${error.message} (code: ${error.code})`);
  }
  console.log(`[meta-ads-sync][ads] Upsert OK, ${rows.length} rows processed`);
  return rows.length;
}

// Priority order: pick the FIRST match only — these action types overlap
// (e.g. messaging_first_reply and messaging_conversation_started_7d
// represent the same conversion measured differently). Summing would double-count.
const LEAD_ACTION_PRIORITY = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_first_reply",
  "messaging_first_reply",
  "lead",
  "onsite_conversion.lead_grouped",
];

function extractVideoAction(videoActions: any[] | undefined): number {
  if (!videoActions || !videoActions[0]) return 0;
  return parseInt(videoActions[0].value) || 0;
}

function extractLeads(actions: any[] | undefined): number {
  if (!actions) return 0;
  for (const type of LEAD_ACTION_PRIORITY) {
    const match = actions.find((a: any) => a.action_type === type);
    if (match) return parseInt(match.value) || 0;
  }
  return 0;
}

async function insertInsightsBatch(
  supabase: any,
  rows: any[],
  nivel: string
): Promise<number> {
  const batchSize = 200;
  let totalInserted = 0;
  for (let idx = 0; idx < rows.length; idx += batchSize) {
    const batch = rows.slice(idx, idx + batchSize);
    const batchNum = Math.floor(idx / batchSize) + 1;
    console.log(`[meta-ads-sync][insights][${nivel}] Inserting batch ${batchNum} (${batch.length} rows)...`);

    const { error } = await supabase.from("meta_insights").insert(batch);

    if (error) {
      console.error(`[meta-ads-sync][insights][${nivel}] Insert batch ${batchNum} FAILED: ${JSON.stringify(error)}`);
      throw new Error(`Insert insights (${nivel}) batch ${batchNum} error: ${error.message} (code: ${error.code})`);
    }
    totalInserted += batch.length;
    console.log(`[meta-ads-sync][insights][${nivel}] Batch ${batchNum} OK (${totalInserted}/${rows.length} total)`);
  }
  return totalInserted;
}

async function syncInsights(
  supabase: any,
  adAccountId: string,
  accessToken: string,
  organizationId: string
): Promise<number> {
  let totalInsights = 0;

  // ---- CAMPAIGN-LEVEL insights ----
  console.log(`[meta-ads-sync][insights][campaign] Starting campaign-level fetch for ${adAccountId}...`);
  const campaignUrl = `${META_BASE_URL}/${adAccountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,reach,cpm,cpc,ctr,cpp,frequency,unique_clicks,unique_ctr,video_30_sec_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,actions&level=campaign&date_preset=last_90d&time_increment=1&limit=500`;
  console.log(`[meta-ads-sync][insights][campaign] URL: ${campaignUrl.replace(/access_token=[^&]+/, 'access_token=HIDDEN')}`);

  let campaignInsights: any[] = [];
  try {
    campaignInsights = await fetchAllPages(campaignUrl, accessToken);
    console.log(`[meta-ads-sync][insights][campaign] Fetched ${campaignInsights.length} records`);
  } catch (err) {
    console.error(`[meta-ads-sync][insights][campaign] Fetch FAILED: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }

  if (campaignInsights.length > 0) {
    console.log(`[meta-ads-sync][insights][campaign] Sample: ${JSON.stringify(campaignInsights[0]).substring(0, 500)}`);

    // Delete existing campaign-level rows for this org before inserting fresh data
    console.log(`[meta-ads-sync][insights][campaign] Deleting existing campaign-level rows for org...`);
    const { error: delErr, count: delCount } = await supabase
      .from("meta_insights")
      .delete()
      .eq("organization_id", organizationId)
      .eq("nivel", "campaign");
    console.log(`[meta-ads-sync][insights][campaign] Deleted ${delCount ?? '?'} existing rows (error: ${delErr ? JSON.stringify(delErr) : 'none'})`);

    const allActionTypes = new Set<string>();
    campaignInsights.forEach((i: any) => {
      i.actions?.forEach((a: any) => allActionTypes.add(a.action_type));
    });
    console.log(`[meta-ads-sync][insights][campaign] All action_types found: ${JSON.stringify([...allActionTypes])}`);

    const campaignRows = campaignInsights.map((i: any) => {
      const leads = extractLeads(i.actions);
      return {
        organization_id: organizationId,
        meta_campaign_id: i.campaign_id,
        meta_adset_id: null,
        meta_ad_id: null,
        nivel: "campaign",
        data_ref: i.date_start,
        impressoes: parseInt(i.impressions || "0"),
        cliques: parseInt(i.clicks || "0"),
        gasto: parseFloat(i.spend || "0"),
        alcance: parseInt(i.reach || "0"),
        cpm: parseFloat(i.cpm || "0"),
        cpc: parseFloat(i.cpc || "0"),
        ctr: parseFloat(i.ctr || "0"),
        cpp: parseFloat(i.cpp || "0"),
        leads,
        frequencia: parseFloat(i.frequency || "0"),
        unique_clicks: parseInt(i.unique_clicks || "0"),
        unique_ctr: parseFloat(i.unique_ctr || "0"),
        video_views: extractVideoAction(i.video_30_sec_watched_actions),
        video_p25: extractVideoAction(i.video_p25_watched_actions),
        video_p50: extractVideoAction(i.video_p50_watched_actions),
        video_p75: extractVideoAction(i.video_p75_watched_actions),
        video_p100: extractVideoAction(i.video_p100_watched_actions),
        quality_ranking: i.quality_ranking || null,
        engagement_ranking: i.engagement_rate_ranking || null,
        conversion_ranking: i.conversion_rate_ranking || null,
      };
    });

    console.log(`[meta-ads-sync][insights][campaign] Mapped ${campaignRows.length} rows for insert`);
    const count = await insertInsightsBatch(supabase, campaignRows, "campaign");
    totalInsights += count;
  } else {
    console.log(`[meta-ads-sync][insights][campaign] No campaign insights returned — skipping`);
  }

  // ---- AD-LEVEL insights ----
  console.log(`[meta-ads-sync][insights][ad] Starting ad-level fetch for ${adAccountId}...`);
  const adUrl = `${META_BASE_URL}/${adAccountId}/insights?fields=campaign_id,adset_id,ad_id,ad_name,impressions,clicks,spend,reach,cpm,cpc,ctr,cpp,frequency,unique_clicks,unique_ctr,video_30_sec_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,actions&level=ad&date_preset=last_90d&time_increment=1&limit=500`;
  console.log(`[meta-ads-sync][insights][ad] URL: ${adUrl.replace(/access_token=[^&]+/, 'access_token=HIDDEN')}`);

  let adInsights: any[] = [];
  try {
    adInsights = await fetchAllPages(adUrl, accessToken);
    console.log(`[meta-ads-sync][insights][ad] Fetched ${adInsights.length} records`);
  } catch (err) {
    console.error(`[meta-ads-sync][insights][ad] Fetch FAILED: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }

  if (adInsights.length > 0) {
    console.log(`[meta-ads-sync][insights][ad] Sample: ${JSON.stringify(adInsights[0]).substring(0, 500)}`);

    // Delete existing ad-level rows for this org before inserting fresh data
    console.log(`[meta-ads-sync][insights][ad] Deleting existing ad-level rows for org...`);
    const { error: delErr, count: delCount } = await supabase
      .from("meta_insights")
      .delete()
      .eq("organization_id", organizationId)
      .eq("nivel", "ad");
    console.log(`[meta-ads-sync][insights][ad] Deleted ${delCount ?? '?'} existing rows (error: ${delErr ? JSON.stringify(delErr) : 'none'})`);

    const adActionTypes = new Set<string>();
    adInsights.forEach((i: any) => {
      i.actions?.forEach((a: any) => adActionTypes.add(a.action_type));
    });
    console.log(`[meta-ads-sync][insights][ad] All action_types found: ${JSON.stringify([...adActionTypes])}`);

    const adRows = adInsights.map((i: any) => {
      const leads = extractLeads(i.actions);
      return {
        organization_id: organizationId,
        meta_campaign_id: i.campaign_id,
        meta_adset_id: i.adset_id,
        meta_ad_id: i.ad_id,
        nivel: "ad",
        data_ref: i.date_start,
        impressoes: parseInt(i.impressions || "0"),
        cliques: parseInt(i.clicks || "0"),
        gasto: parseFloat(i.spend || "0"),
        alcance: parseInt(i.reach || "0"),
        cpm: parseFloat(i.cpm || "0"),
        cpc: parseFloat(i.cpc || "0"),
        ctr: parseFloat(i.ctr || "0"),
        cpp: parseFloat(i.cpp || "0"),
        leads,
        frequencia: parseFloat(i.frequency || "0"),
        unique_clicks: parseInt(i.unique_clicks || "0"),
        unique_ctr: parseFloat(i.unique_ctr || "0"),
        video_views: extractVideoAction(i.video_30_sec_watched_actions),
        video_p25: extractVideoAction(i.video_p25_watched_actions),
        video_p50: extractVideoAction(i.video_p50_watched_actions),
        video_p75: extractVideoAction(i.video_p75_watched_actions),
        video_p100: extractVideoAction(i.video_p100_watched_actions),
        quality_ranking: i.quality_ranking || null,
        engagement_ranking: i.engagement_rate_ranking || null,
        conversion_ranking: i.conversion_rate_ranking || null,
      };
    });

    console.log(`[meta-ads-sync][insights][ad] Mapped ${adRows.length} rows for insert`);
    const count = await insertInsightsBatch(supabase, adRows, "ad");
    totalInsights += count;
  } else {
    console.log(`[meta-ads-sync][insights][ad] No ad insights returned — skipping`);
  }

  console.log(`[meta-ads-sync][insights] TOTAL insights synced: ${totalInsights} (campaign + ad)`);
  return totalInsights;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[meta-ads-sync] ========== SYNC STARTED ==========`);
  console.log(`[meta-ads-sync] Method: ${req.method}, URL: ${req.url}`);

  try {
    // Service role key para acesso irrestrito ao banco (bypassa RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log(`[meta-ads-sync] SUPABASE_URL defined: ${!!supabaseUrl}`);
    console.log(`[meta-ads-sync] SERVICE_ROLE_KEY defined: ${!!serviceRoleKey}`);

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`[meta-ads-sync] Missing env vars!`);
      return jsonResponse({ error: "Server misconfiguration: missing env vars" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    console.log(`[meta-ads-sync] Supabase admin client created (service_role)`);

    // Parse body
    let organizationId: string | null = null;
    if (req.method === "POST") {
      const rawBody = await req.text();
      console.log(`[meta-ads-sync] Raw body: ${rawBody}`);
      try {
        const body = JSON.parse(rawBody);
        organizationId = body.organization_id || null;
      } catch (parseErr) {
        console.error(`[meta-ads-sync] JSON parse error: ${parseErr}`);
        return jsonResponse({ error: "Invalid JSON body", details: String(parseErr) }, 400);
      }
    }

    if (!organizationId) {
      console.error(`[meta-ads-sync] No organization_id provided`);
      return jsonResponse({ error: "organization_id is required in POST body" }, 400);
    }

    console.log(`[meta-ads-sync] Organization ID: ${organizationId}`);

    // Buscar integração com service_role (bypassa RLS)
    console.log(`[meta-ads-sync] Querying integracoes table...`);
    const { data: integration, error: intError } = await supabaseAdmin
      .from("integracoes")
      .select("id, credenciais, configuracoes, status, tipo, organization_id")
      .eq("organization_id", organizationId)
      .eq("tipo", "meta_ads")
      .eq("status", "active")
      .maybeSingle();

    console.log(`[meta-ads-sync] Integration query result - data: ${JSON.stringify(integration ? { id: integration.id, status: integration.status, tipo: integration.tipo, has_credenciais: !!integration.credenciais } : null)}, error: ${JSON.stringify(intError)}`);

    if (intError) {
      console.error(`[meta-ads-sync] DB error fetching integration: ${JSON.stringify(intError)}`);
      return jsonResponse({
        error: "Database error fetching integration",
        details: intError.message,
        code: intError.code,
      }, 500);
    }

    if (!integration) {
      console.error(`[meta-ads-sync] No active meta_ads integration found for org ${organizationId}`);
      // Listar todas integrações da org para debug
      const { data: allIntegrations } = await supabaseAdmin
        .from("integracoes")
        .select("id, tipo, status, organization_id")
        .eq("organization_id", organizationId);
      console.log(`[meta-ads-sync] All integrations for org: ${JSON.stringify(allIntegrations)}`);

      return jsonResponse({
        error: "No active Meta Ads integration found for this organization",
        organization_id: organizationId,
        existing_integrations: allIntegrations?.map((i: any) => ({ id: i.id, tipo: i.tipo, status: i.status })) || [],
      }, 404);
    }

    // Extrair access_token
    const credenciais = integration.credenciais;
    console.log(`[meta-ads-sync] Credenciais type: ${typeof credenciais}, keys: ${credenciais ? Object.keys(credenciais).join(', ') : 'null'}`);

    const accessToken = credenciais?.access_token;
    if (!accessToken) {
      console.error(`[meta-ads-sync] No access_token in credenciais`);
      return jsonResponse({
        error: "Access token not found in integration credentials",
        credenciais_keys: credenciais ? Object.keys(credenciais) : [],
      }, 400);
    }

    console.log(`[meta-ads-sync] Access token found (${accessToken.substring(0, 10)}...${accessToken.substring(accessToken.length - 5)})`);

    const adAccountId = credenciais?.ad_account_id || integration.configuracoes?.ad_account_id || "act_706428550220397";
    console.log(`[meta-ads-sync] Ad Account ID: ${adAccountId}`);

    // Sync sequencial: campaigns -> adsets -> ads -> insights
    const counts: SyncCounts = { campaigns: 0, adsets: 0, ads: 0, insights: 0 };

    console.log(`[meta-ads-sync] ---- STEP 1/4: CAMPAIGNS ----`);
    counts.campaigns = await syncCampaigns(supabaseAdmin, adAccountId, accessToken, organizationId);

    console.log(`[meta-ads-sync] ---- STEP 2/4: ADSETS ----`);
    counts.adsets = await syncAdsets(supabaseAdmin, adAccountId, accessToken, organizationId);

    console.log(`[meta-ads-sync] ---- STEP 3/4: ADS ----`);
    counts.ads = await syncAds(supabaseAdmin, adAccountId, accessToken, organizationId);

    console.log(`[meta-ads-sync] ---- STEP 4/4: INSIGHTS ----`);
    counts.insights = await syncInsights(supabaseAdmin, adAccountId, accessToken, organizationId);

    // Atualizar ultima_sincronizacao
    console.log(`[meta-ads-sync] Updating ultima_sincronizacao...`);
    const { error: updateError } = await supabaseAdmin
      .from("integracoes")
      .update({
        ultima_sincronizacao: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", integration.id);

    if (updateError) {
      console.error(`[meta-ads-sync] Failed to update ultima_sincronizacao: ${JSON.stringify(updateError)}`);
    } else {
      console.log(`[meta-ads-sync] ultima_sincronizacao updated OK`);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[meta-ads-sync] ========== SYNC COMPLETED in ${elapsed}ms ==========`);
    console.log(`[meta-ads-sync] Results: ${JSON.stringify(counts)}`);

    return jsonResponse({
      success: true,
      organization_id: organizationId,
      ad_account_id: adAccountId,
      synced: counts,
      synced_at: new Date().toISOString(),
      elapsed_ms: elapsed,
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error(`[meta-ads-sync] ========== SYNC FAILED after ${elapsed}ms ==========`);
    console.error(`[meta-ads-sync] Error: ${errMsg}`);
    if (errStack) console.error(`[meta-ads-sync] Stack: ${errStack}`);

    return jsonResponse({
      error: "Sync failed",
      details: errMsg,
      elapsed_ms: elapsed,
    }, 500);
  }
});
