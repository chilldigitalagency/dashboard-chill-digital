const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// ─── Token único (System User) para todas las cuentas de clientes ─────────────

export function getMetaSystemUserToken(): string {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) {
    throw new Error("META_SYSTEM_USER_TOKEN no está configurado.");
  }
  return token;
}

/**
 * Resuelve el token a usar para un cliente: si tiene un token propio cargado
 * (cuentas personales que el System User no puede administrar), se usa ese;
 * si no, se usa el token único del System User.
 */
export function resolveMetaAccessToken(clientOverrideToken?: string | null): string {
  if (clientOverrideToken && clientOverrideToken.trim()) {
    return clientOverrideToken.trim();
  }
  return getMetaSystemUserToken();
}

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
  messages: number;
  cost_per_message: number;
  ig_profile_visits: number;
  landing_page_view: number;
  add_to_cart: number;
  initiate_checkout: number;
  dateStart?: string;
  dateStop?: string;
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
  instagram_profile_visits?: string;
  date_start?: string;
  date_stop?: string;
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
    fields: "spend,impressions,reach,frequency,clicks,ctr,cpm,cpp,actions,action_values,cost_per_action_type,instagram_profile_visits",
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

    const messages = findActionValue(row.actions, ["onsite_conversion.messaging_conversation_started_7d"]);
    const cost_per_message = findActionValue(row.cost_per_action_type, ["onsite_conversion.messaging_conversation_started_7d"]);
    const ig_profile_visits = parseFloat(row.instagram_profile_visits ?? "0") || 0;

    const landing_page_view = findActionValue(row.actions, ["landing_page_view"]);
    const add_to_cart = findActionValue(row.actions, ["add_to_cart"]);
    const initiate_checkout = findActionValue(row.actions, ["initiate_checkout"]);
    return { spend, purchases, revenue, roas, cpa, ctr, cpm, reach, impressions, frequency, clicks, messages, cost_per_message, ig_profile_visits, landing_page_view, add_to_cart, initiate_checkout };
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
  impressions: number;
  frequency: number;
  clicks: number;
  add_to_cart: number;
  cost_per_add_to_cart: number;
  initiate_checkout: number;
  cost_per_initiate_checkout: number;
  landing_page_view: number;
  cost_per_landing_page_view: number;
  outbound_clicks: number;
  outbound_clicks_ctr: number;
  messages: number;
  cost_per_message: number;
  ig_profile_visits: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  insights: CampaignInsights | null;
}

export type AdInsights = CampaignInsights;

export interface Ad {
  id: string;
  name: string;
  status: string;
  campaign_id: string | null;
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
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  insights?: RawInsightsBlock;
}

interface RawAd {
  id: string;
  name: string;
  status: string;
  effective_status?: string;
  campaign_id?: string;
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
  const impressions = parseFloat(row.impressions ?? "0") || 0;
  const frequency = parseFloat(row.frequency ?? "0") || 0;
  const clicks = parseFloat(row.clicks ?? "0") || 0;
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

  const messages = findActionValue(row.actions, ["onsite_conversion.messaging_conversation_started_7d"]);
  const cost_per_message = findActionValue(row.cost_per_action_type, ["onsite_conversion.messaging_conversation_started_7d"]);
  const ig_profile_visits =
    parseFloat(row.instagram_profile_visits ?? "0") ||
    findActionValue(row.actions, ["instagram_profile_visit", "instagram_profile_visits"]);

  return {
    spend, purchases, revenue, roas, cpa, ctr, cpm, reach, impressions, frequency, clicks,
    add_to_cart, cost_per_add_to_cart,
    initiate_checkout, cost_per_initiate_checkout,
    landing_page_view, cost_per_landing_page_view,
    outbound_clicks, outbound_clicks_ctr,
    messages, cost_per_message, ig_profile_visits,
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
    fields: "spend,impressions,reach,frequency,clicks,ctr,cpm,actions,action_values,cost_per_action_type,date_start,date_stop",
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

    const messages = findActionValue(row.actions, ["onsite_conversion.messaging_conversation_started_7d"]);
    const cost_per_message = findActionValue(row.cost_per_action_type, ["onsite_conversion.messaging_conversation_started_7d"]);
    const landing_page_view = findActionValue(row.actions, ["landing_page_view"]);
    const add_to_cart = findActionValue(row.actions, ["add_to_cart"]);
    const initiate_checkout = findActionValue(row.actions, ["initiate_checkout"]);

    return {
      spend, purchases, revenue, roas, cpa, ctr, cpm, reach, impressions, frequency, clicks,
      messages, cost_per_message, ig_profile_visits: 0,
      landing_page_view, add_to_cart, initiate_checkout,
      dateStart: row.date_start,
      dateStop: row.date_stop,
    };
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

export async function fetchIgVisitsTotal(
  accountId: string,
  accessToken: string,
  dateFilter: DateFilter
): Promise<number> {
  try {
    const insightsFields = `insights.${insightsDateParam(dateFilter)}{instagram_profile_visits}`;
    const params = new URLSearchParams({
      fields: `id,${insightsFields}`,
      effective_status: '["ACTIVE","PAUSED"]',
      access_token: accessToken,
      limit: "100",
    });
    const url = `${META_API_BASE}/${accountId}/campaigns?${params.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { data?: { insights?: { data?: { instagram_profile_visits?: string }[] } }[]; error?: unknown };
    if (!res.ok || json.error) return 0;
    return (json.data ?? []).reduce((sum, c) => {
      const val = c.insights?.data?.[0]?.instagram_profile_visits;
      return sum + (val ? parseFloat(val) || 0 : 0);
    }, 0);
  } catch { return 0; }
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function fetchCampaigns(
  accountId: string,
  accessToken: string,
  dateFilter: DateFilter
): Promise<Campaign[]> {
  const insightsFields = `insights.${insightsDateParam(dateFilter)}{spend,impressions,reach,frequency,clicks,actions,action_values,ctr,cpm,cost_per_action_type,outbound_clicks,outbound_clicks_ctr,instagram_profile_visits}`;
  const params = new URLSearchParams({
    fields: `id,name,status,effective_status,objective,daily_budget,lifetime_budget,${insightsFields}`,
    effective_status: '["ACTIVE","PAUSED"]',
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
        objective: c.objective ?? null,
        daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
        lifetime_budget: c.lifetime_budget && c.lifetime_budget !== "0"
          ? parseFloat(c.lifetime_budget) / 100
          : null,
        insights: row ? parseInsightsRow(row) : null,
      };
    })
    .filter((c) => c.status === "ACTIVE" || (c.insights !== null && c.insights.spend > 0));
}

// ─── Ads ──────────────────────────────────────────────────────────────────────

export async function fetchAds(
  accountId: string,
  accessToken: string,
  dateFilter: DateFilter
): Promise<Ad[]> {
  const insightsFields = `insights.${insightsDateParam(dateFilter)}{spend,impressions,reach,frequency,clicks,actions,action_values,ctr,cpm,cost_per_action_type,outbound_clicks,outbound_clicks_ctr,instagram_profile_visits}`;
  const params = new URLSearchParams({
    fields: `id,name,status,effective_status,campaign_id,creative{thumbnail_url},${insightsFields}`,
    effective_status: '["ACTIVE","PAUSED"]',
    access_token: accessToken,
    limit: "50",
  });
  const firstUrl = `${META_API_BASE}/${accountId}/ads?${params.toString()}`;
  const ads = await metaFetchAll<RawAd>(firstUrl);

  return ads
    .map((ad) => {
      const row = ad.insights?.data?.[0];
      return {
        id: ad.id,
        name: ad.name,
        status: ad.effective_status ?? ad.status,
        campaign_id: ad.campaign_id ?? null,
        thumbnail_url: ad.creative?.thumbnail_url ?? null,
        insights: row ? parseInsightsRow(row) : null,
      };
    })
    .filter((ad) => ad.status === "ACTIVE" || (ad.insights !== null && ad.insights.spend > 0));
}

// ─── Servicios: daily insights by campaign objective ─────────────────────────

export interface ServiciosDailyPoint {
  date: string;
  totalSpend: number;
  igVisits: number;
  igSpend: number;
  messages: number;
  msgSpend: number;
  landingViews: number;
  landingSpend: number;
}

interface RawDailyCampaignInsight {
  campaign_id?: string;
  spend?: string;
  instagram_profile_visits?: string;
  actions?: MetaAction[];
  date_start?: string;
}

const MESSAGING_OBJ_SET = new Set(["MESSAGES", "OUTCOME_ENGAGEMENT"]);
const TRAFFIC_OBJ_SET   = new Set(["LINK_CLICKS", "OUTCOME_TRAFFIC"]);

export async function fetchServiciosDailyInsights(
  accountId: string,
  accessToken: string,
  dateFilter: DateFilter
): Promise<ServiciosDailyPoint[]> {
  try {
    const objParams = new URLSearchParams({
      fields: "id,objective",
      effective_status: '["ACTIVE","PAUSED"]',
      access_token: accessToken,
      limit: "200",
    });

    const insParams = new URLSearchParams({
      level: "campaign",
      time_increment: "1",
      fields: "campaign_id,spend,instagram_profile_visits,actions",
      access_token: accessToken,
      limit: "500",
    });
    applyDateFilter(insParams, dateFilter);

    const [objJson, insRows] = await Promise.all([
      fetch(`${META_API_BASE}/${accountId}/campaigns?${objParams}`, { cache: "no-store" })
        .then((r) => r.json() as Promise<{ data?: { id: string; objective?: string }[] }>),
      metaFetchAll<RawDailyCampaignInsight>(`${META_API_BASE}/${accountId}/insights?${insParams}`),
    ]);

    const objectiveMap = new Map<string, string>();
    for (const c of objJson.data ?? []) {
      if (c.objective) objectiveMap.set(c.id, c.objective);
    }

    const byDate = new Map<string, ServiciosDailyPoint>();

    for (const row of insRows) {
      const date = row.date_start ?? "";
      if (!date) continue;

      if (!byDate.has(date)) {
        byDate.set(date, { date, totalSpend: 0, igVisits: 0, igSpend: 0, messages: 0, msgSpend: 0, landingViews: 0, landingSpend: 0 });
      }

      const point = byDate.get(date)!;
      const spend = parseFloat(row.spend ?? "0") || 0;
      const objective = objectiveMap.get(row.campaign_id ?? "") ?? "";
      const igVisits = parseFloat(row.instagram_profile_visits ?? "0") || findActionValue(row.actions, ["instagram_profile_visit"]);
      const landingViews = findActionValue(row.actions, ["landing_page_view"]);
      const messages = findActionValue(row.actions, ["onsite_conversion.messaging_conversation_started_7d"]);

      point.totalSpend += spend;

      if (MESSAGING_OBJ_SET.has(objective)) {
        point.messages += messages;
        point.msgSpend += spend;
      } else if (TRAFFIC_OBJ_SET.has(objective)) {
        if (igVisits > 0) { point.igVisits += igVisits; point.igSpend += spend; }
        if (landingViews > 0) { point.landingViews += landingViews; point.landingSpend += spend; }
      } else {
        if (messages > 0) { point.messages += messages; point.msgSpend += spend; }
        else if (igVisits > 0) { point.igVisits += igVisits; point.igSpend += spend; }
        else if (landingViews > 0) { point.landingViews += landingViews; point.landingSpend += spend; }
      }
    }

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

// ─── Daily insights ───────────────────────────────────────────────────────────

export interface DailyInsightsPoint {
  date: string;
  purchases: number;
  spend: number;
  cpa: number;
  revenue: number;
  roas: number;
  landing_page_views: number;
  cost_per_landing_page_view: number;
  messages: number;
  ig_profile_visits: number;
  cpm: number;
  ctr: number;
}

interface RawDailyRow extends MetaInsightsData {
  date_start?: string;
}

export async function fetchDailyInsights(
  accountId: string,
  accessToken: string,
  dateFilter: DateFilter
): Promise<DailyInsightsPoint[]> {
  const params = new URLSearchParams({
    fields: "spend,impressions,ctr,cpm,actions,action_values,cost_per_action_type,outbound_clicks,instagram_profile_visits",
    level: "account",
    time_increment: "1",
    limit: "90",
    access_token: accessToken,
  });
  applyDateFilter(params, dateFilter);
  const url = `${META_API_BASE}/${accountId}/insights?${params.toString()}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { data?: RawDailyRow[]; error?: { message: string } };
    if (!res.ok || json.error) {
      console.error("[Meta Ads] daily error:", json.error?.message ?? res.statusText);
      return [];
    }
    return (json.data ?? []).map((row) => {
      const spend = parseFloat(row.spend ?? "0") || 0;
      const purchases = findActionValue(row.actions, PURCHASE_TYPES);
      const revenue = findActionValue(row.action_values, PURCHASE_TYPES);
      const cpa = findActionValue(row.cost_per_action_type, PURCHASE_TYPES);
      const computedCpa = cpa > 0 ? cpa : purchases > 0 ? spend / purchases : 0;
      const roas = spend > 0 ? revenue / spend : 0;
      const landing_page_views = findActionValue(row.actions, ["landing_page_view"]);
      const cost_per_landing_page_view = findActionValue(row.cost_per_action_type, ["landing_page_view"]);
      const messages = findActionValue(row.actions, ["onsite_conversion.messaging_conversation_started_7d"]);
      const ig_profile_visits =
        parseFloat(row.instagram_profile_visits ?? "0") ||
        findActionValue(row.actions, ["instagram_profile_visit", "instagram_profile_visits"]);
      const cpm = parseFloat(row.cpm ?? "0") || 0;
      const ctr = parseFloat(row.ctr ?? "0") || 0;
      return { date: row.date_start ?? "", purchases, spend, cpa: computedCpa, revenue, roas, landing_page_views, cost_per_landing_page_view, messages, ig_profile_visits, cpm, ctr };
    });
  } catch {
    return [];
  }
}
