const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// ─── Date filter (preset or custom range) ─────────────────────────────────────

export type DateFilter =
  | { type: "preset"; preset: string }
  | { type: "custom"; since: string; until: string };

function applyDateFilter(params: URLSearchParams, filter: DateFilter) {
  if (filter.type === "preset") {
    params.set("date_preset", filter.preset);
  } else {
    params.set("time_range", JSON.stringify({ since: filter.since, until: filter.until }));
  }
}

function insightsDateParam(filter: DateFilter): string {
  if (filter.type === "preset") return `date_preset(${filter.preset})`;
  return `time_range({"since":"${filter.since}","until":"${filter.until}"})`;
}

const PURCHASE_TYPES = ["omni_purchase", "purchase"];

export interface MetaAdsInsights {
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  reach: number;
  impressions: number;
  frequency: number;
  clicks: number;
}

interface MetaAction {
  action_type: string;
  value: string;
}

interface MetaInsightsData {
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  cpp?: string;
  outbound_clicks_ctr?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  cost_per_action_type?: MetaAction[];
  outbound_clicks?: MetaAction[];
}

interface MetaInsightsResponse {
  data: MetaInsightsData[];
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

function findActionValue(actions: MetaAction[] | undefined, types: string[]): number {
  if (!actions) return 0;
  const match = actions.find((a) => types.includes(a.action_type));
  return match ? parseFloat(match.value) || 0 : 0;
}

export async function fetchMetaAds(
  accountId: string,
  accessToken: string,
  datePreset: string
): Promise<MetaAdsInsights | null> {
  const params = new URLSearchParams({
    fields: "spend,impressions,reach,frequency,clicks,ctr,cpm,cpp,actions,action_values",
    date_preset: datePreset,
    level: "account",
    access_token: accessToken,
  });

  const url = `${META_API_BASE}/${accountId}/insights?${params.toString()}`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    const json = (await response.json()) as MetaInsightsResponse;

    if (!response.ok || json.error) {
      console.error("[Meta Ads] API error:", json.error?.message ?? response.statusText);
      return null;
    }

    const row: MetaInsightsData = json.data?.[0] ?? {};

    const spend = parseFloat(row.spend ?? "0") || 0;
    const impressions = parseFloat(row.impressions ?? "0") || 0;
    const reach = parseFloat(row.reach ?? "0") || 0;
    const frequency = parseFloat(row.frequency ?? "0") || 0;
    const clicks = parseFloat(row.clicks ?? "0") || 0;
    const ctr = parseFloat(row.ctr ?? "0") || 0;
    const cpm = parseFloat(row.cpm ?? "0") || 0;

    const purchases = findActionValue(row.actions, PURCHASE_TYPES);
    const revenue = findActionValue(row.action_values, PURCHASE_TYPES);

    const roas = spend > 0 ? revenue / spend : 0;
    const cpa = purchases > 0 ? spend / purchases : 0;

    return { spend, purchases, revenue, roas, cpa, ctr, cpm, reach, impressions, frequency, clicks };
  } catch {
    return null;
  }
}

// ─── Types: campaigns & ads ───────────────────────────────────────────────────

export interface CampaignInsights {
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  reach: number;
  frequency: number;
  add_to_cart: number;
  cost_per_add_to_cart: number;
  initiate_checkout: number;
  cost_per_initiate_checkout: number;
  landing_page_view: number;
  cost_per_landing_page_view: number;
  outbound_clicks: number;
  outbound_clicks_ctr: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  insights: CampaignInsights | null;
}

export type AdInsights = CampaignInsights;

export interface Ad {
  id: string;
  name: string;
  status: string;
  thumbnail_url: string | null;
  insights: AdInsights | null;
}

// ─── Raw Meta types for campaigns / ads ──────────────────────────────────────

interface RawInsightsBlock {
  data?: MetaInsightsData[];
}

interface RawCampaign {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  insights?: RawInsightsBlock;
}

interface RawAd {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  creative?: { thumbnail_url?: string };
  insights?: RawInsightsBlock;
}

interface RawListResponse<T> {
  data?: T[];
  paging?: { next?: string };
  error?: { message: string; code: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseInsightsRow(row: MetaInsightsData): CampaignInsights {
  const spend = parseFloat(row.spend ?? "0") || 0;
  const ctr = parseFloat(row.ctr ?? "0") || 0;
  const cpm = parseFloat(row.cpm ?? "0") || 0;
  const reach = parseFloat(row.reach ?? "0") || 0;
  const frequency = parseFloat(row.frequency ?? "0") || 0;
  const purchases = findActionValue(row.actions, PURCHASE_TYPES);
  const revenue = findActionValue(row.action_values, PURCHASE_TYPES);
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = findActionValue(row.cost_per_action_type, PURCHASE_TYPES);

  const add_to_cart = findActionValue(row.actions, ["add_to_cart"]);
  const initiate_checkout = findActionValue(row.actions, ["initiate_checkout"]);
  const landing_page_view = findActionValue(row.actions, ["landing_page_view"]);

  const cost_per_add_to_cart = findActionValue(row.cost_per_action_type, ["add_to_cart"]);
  const cost_per_initiate_checkout = findActionValue(row.cost_per_action_type, ["initiate_checkout"]);
  const cost_per_landing_page_view = findActionValue(row.cost_per_action_type, ["landing_page_view"]);

  const outbound_clicks = findActionValue(row.outbound_clicks, ["outbound_click"]);
  const outbound_clicks_ctr = parseFloat(row.outbound_clicks_ctr ?? "0") || 0;

  return {
    spend, purchases, revenue, roas, cpa, ctr, cpm, reach, frequency,
    add_to_cart, cost_per_add_to_cart,
    initiate_checkout, cost_per_initiate_checkout,
    landing_page_view, cost_per_landing_page_view,
    outbound_clicks, outbound_clicks_ctr,
  };
}

async function metaFetch<T>(url: string): Promise<RawListResponse<T> | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as RawListResponse<T>;
    if (!res.ok || json.error) {
      console.error("[Meta Ads] fetch error:", json.error?.message ?? res.statusText);
      return null;
    }
    return json;
  } catch {
    return null;
  }
}

// ─── Account insights (detailed) ─────────────────────────────────────────────

export async function fetchAccountInsights(
  accountId: string,
  accessToken: string,
  dateFilter: DateFilter
): Promise<MetaAdsInsights | null> {
  const params = new URLSearchParams({
    fields: "spend,impressions,reach,frequency,clicks,ctr,cpm,cpp,actions,action_values,cost_per_action_type",
    level: "account",
    access_token: accessToken,
  });
  applyDateFilter(params, dateFilter);
  const url = `${META_API_BASE}/${accountId}/insights?${params.toString()}`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    const json = (await response.json()) as MetaInsightsResponse;

    if (!response.ok || json.error) {
      console.error("[Meta Ads] account insights error:", json.error?.message ?? response.statusText);
      return null;
    }

    const row: MetaInsightsData = json.data?.[0] ?? {};
    const spend = parseFloat(row.spend ?? "0") || 0;
    const impressions = parseFloat(row.impressions ?? "0") || 0;
    const reach = parseFloat(row.reach ?? "0") || 0;
    const frequency = parseFloat(row.frequency ?? "0") || 0;
    const clicks = parseFloat(row.clicks ?? "0") || 0;
    const ctr = parseFloat(row.ctr ?? "0") || 0;
    const cpm = parseFloat(row.cpm ?? "0") || 0;
    const purchases = findActionValue(row.actions, PURCHASE_TYPES);
    const revenue = findActionValue(row.action_values, PURCHASE_TYPES);
    const roas = spend > 0 ? revenue / spend : 0;
    const cpa = purchases > 0 ? spend / purchases : 0;

    return { spend, purchases, revenue, roas, cpa, ctr, cpm, reach, impressions, frequency, clicks };
  } catch {
    return null;
  }
}

// ─── Pagination helper ────────────────────────────────────────────────────────

async function metaFetchAll<T>(firstUrl: string): Promise<T[]> {
  const all: T[] = [];
  let url: string | undefined = firstUrl;
  while (url) {
    const json: RawListResponse<T> | null = await metaFetch<T>(url);
    if (!json) break;
    all.push(...(json.data ?? []));
    url = json.paging?.next;
  }
  return all;
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function fetchCampaigns(
  accountId: string,
  accessToken: string,
  dateFilter: DateFilter
): Promise<Campaign[]> {
  const insightsFields = `insights.${insightsDateParam(dateFilter)}{spend,reach,frequency,actions,action_values,ctr,cpm,cost_per_action_type,outbound_clicks,outbound_clicks_ctr}`;
  const params = new URLSearchParams({
    fields: `id,name,status,effective_status,daily_budget,lifetime_budget,${insightsFields}`,
    effective_status: '["ACTIVE"]',
    access_token: accessToken,
    limit: "100",
  });
  const firstUrl = `${META_API_BASE}/${accountId}/campaigns?${params.toString()}`;
  const campaigns = await metaFetchAll<RawCampaign>(firstUrl);

  return campaigns
    .map((c) => {
      const row = c.insights?.data?.[0];
      return {
        id: c.id,
        name: c.name,
        status: c.effective_status ?? c.status,
        daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
        lifetime_budget: c.lifetime_budget && c.lifetime_budget !== "0"
          ? parseFloat(c.lifetime_budget) / 100
          : null,
        insights: row ? parseInsightsRow(row) : null,
      };
    });
}

// ─── Ads ──────────────────────────────────────────────────────────────────────

export async function fetchAds(
  accountId: string,
  accessToken: string,
  dateFilter: DateFilter
): Promise<Ad[]> {
  const insightsFields = `insights.${insightsDateParam(dateFilter)}{spend,reach,frequency,actions,action_values,ctr,cpm,cost_per_action_type,outbound_clicks,outbound_clicks_ctr}`;
  const params = new URLSearchParams({
    fields: `id,name,status,effective_status,creative{thumbnail_url},${insightsFields}`,
    effective_status: '["ACTIVE"]',
    access_token: accessToken,
    limit: "50",
  });
  const firstUrl = `${META_API_BASE}/${accountId}/ads?${params.toString()}`;
  const ads = await metaFetchAll<RawAd>(firstUrl);

  return ads.map((ad) => {
      const row = ad.insights?.data?.[0];
      return {
        id: ad.id,
        name: ad.name,
        status: ad.effective_status ?? ad.status,
        thumbnail_url: ad.creative?.thumbnail_url ?? null,
        insights: row ? parseInsightsRow(row) : null,
      };
    });
}
