import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAccountInsights,
  fetchCampaigns,
  fetchAds,
} from "@/lib/meta-ads/client";
import type { DateFilter } from "@/lib/meta-ads/client";

// ─── L1: In-memory cache (5 min TTL, per serverless instance) ────────────────
const memCache = new Map<string, { data: unknown; expiresAt: number }>();
const MEM_TTL_MS = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.data as T;
}
function setCached(key: string, data: unknown) {
  memCache.set(key, { data, expiresAt: Date.now() + MEM_TTL_MS });
}

// ─── L2: Supabase persistent cache (15 min TTL, cross-instance) ──────────────
const DB_TTL_MS = 15 * 60 * 1000;

async function getDbCached<T>(key: string): Promise<T | null> {
  try {
    const { data } = await createAdminClient()
      .from("meta_cache")
      .select("data, expires_at")
      .eq("key", key)
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expires_at) < new Date()) return null;
    return data.data as T;
  } catch { return null; }
}

async function setDbCached(key: string, data: unknown): Promise<void> {
  try {
    const expires_at = new Date(Date.now() + DB_TTL_MS).toISOString();
    await createAdminClient()
      .from("meta_cache")
      .upsert({ key, data, expires_at }, { onConflict: "key" });
  } catch { /* non-fatal */ }
}

const VALID_PRESETS = [
  "today", "yesterday", "last_7d", "last_14d", "last_30d",
  "this_month", "last_month",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fmt(d: Date) { return d.toISOString().split("T")[0]; }

function getMonthComparisonFilter(dateFilter: DateFilter): DateFilter | null {
  if (dateFilter.type !== "preset") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dateFilter.preset === "this_month") {
    const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const prevMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
    return {
      type: "custom",
      since: fmt(new Date(prevYear, prevMonth, 1)),
      until: fmt(new Date(prevYear, prevMonth, today.getDate())),
    };
  }
  if (dateFilter.preset === "last_month") {
    const y = today.getFullYear();
    const m = today.getMonth();
    const prevYear = m <= 1 ? y - 1 : y;
    const prevMonth = m <= 1 ? m + 10 : m - 2;
    return {
      type: "custom",
      since: fmt(new Date(prevYear, prevMonth, 1)),
      until: fmt(new Date(prevYear, prevMonth + 1, 0)),
    };
  }
  return null;
}

function comparisonFromDates(dateStart: string, dateStop: string): DateFilter {
  const since = new Date(dateStart + "T00:00:00");
  const until = new Date(dateStop + "T00:00:00");
  const days = Math.round((until.getTime() - since.getTime()) / 86400000) + 1;
  const prevUntil = new Date(since); prevUntil.setDate(prevUntil.getDate() - 1);
  const prevSince = new Date(prevUntil); prevSince.setDate(prevSince.getDate() - days + 1);
  return { type: "custom", since: fmt(prevSince), until: fmt(prevUntil) };
}

function estimateComparisonFilter(dateFilter: DateFilter): DateFilter {
  if (dateFilter.type === "custom") {
    return comparisonFromDates(dateFilter.since, dateFilter.until);
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  // Single-day presets compare against the immediately preceding day
  if (dateFilter.preset === "today") {
    return { type: "custom", since: fmt(yesterday), until: fmt(yesterday) };
  }
  if (dateFilter.preset === "yesterday") {
    const dayBefore = new Date(yesterday); dayBefore.setDate(dayBefore.getDate() - 1);
    return { type: "custom", since: fmt(dayBefore), until: fmt(dayBefore) };
  }

  const days =
    dateFilter.preset === "last_7d"  ? 7  :
    dateFilter.preset === "last_14d" ? 14 :
    dateFilter.preset === "last_30d" ? 30 : 7;
  const prevUntil = new Date(yesterday); prevUntil.setDate(prevUntil.getDate() - days);
  const prevSince = new Date(prevUntil); prevSince.setDate(prevSince.getDate() - days + 1);
  return { type: "custom", since: fmt(prevSince), until: fmt(prevUntil) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { accountId } = params;
    const sp = request.nextUrl.searchParams;
    const since = sp.get("since");
    const until = sp.get("until");
    const presetParam = sp.get("datePreset") ?? "last_7d";
    const type = sp.get("type") ?? "full"; // "overview" | "breakdown" | "full"

    let dateFilter: DateFilter;
    if (since && until) {
      if (!ISO_DATE.test(since) || !ISO_DATE.test(until)) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
      }
      dateFilter = { type: "custom", since, until };
    } else {
      if (!VALID_PRESETS.includes(presetParam)) {
        return NextResponse.json({ error: "Invalid datePreset" }, { status: 400 });
      }
      dateFilter = { type: "preset", preset: presetParam };
    }

    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    if (!isAdmin) {
      const { data: access } = await admin
        .from("client_user_access").select("client_id")
        .eq("user_id", user.id).eq("client_id", accountId).single();
      if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: client, error: clientError } = await admin
      .from("clients")
      .select("id, name, meta_account_id, meta_access_token, client_type, client_thresholds(roas_min, cpa_max, sales_min)")
      .eq("id", accountId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const { meta_account_id, meta_access_token } = client;
    const threshold = (client.client_thresholds as { roas_min: number; cpa_max: number; sales_min: number }[])?.[0] ?? null;
    const dateKey = since ? `${since}:${until}` : presetParam;

    // ── Overview: only account metrics (fast) ────────────────────────────────
    if (type === "overview") {
      const cacheKey = `${accountId}:overview:${dateKey}`;
      type OvPayload = {
        accountMetrics: Awaited<ReturnType<typeof fetchAccountInsights>>;
        comparisonMetrics: Awaited<ReturnType<typeof fetchAccountInsights>>;
      };
      let payload = getCached<OvPayload>(cacheKey) ?? await getDbCached<OvPayload>(cacheKey);
      if (!payload) {
        const comparisonFilter = getMonthComparisonFilter(dateFilter) ?? estimateComparisonFilter(dateFilter);
        const [accountMetrics, comparisonMetrics] = await Promise.all([
          fetchAccountInsights(meta_account_id, meta_access_token, dateFilter),
          fetchAccountInsights(meta_account_id, meta_access_token, comparisonFilter),
        ]);
        payload = { accountMetrics, comparisonMetrics };
        setCached(cacheKey, payload);
        setDbCached(cacheKey, payload);
      } else {
        setCached(cacheKey, payload); // warm L1 from L2
      }
      return NextResponse.json({
        id: client.id,
        name: client.name,
        meta_account_id,
        client_type: (client.client_type as "ecommerce" | "servicios") ?? "ecommerce",
        thresholds: threshold,
        accountMetrics: payload.accountMetrics,
        comparisonMetrics: payload.comparisonMetrics,
      });
    }

    // ── Breakdown: only campaigns + ads ──────────────────────────────────────
    if (type === "breakdown") {
      const cacheKey = `${accountId}:breakdown:${dateKey}`;
      type BdPayload = {
        campaigns: Awaited<ReturnType<typeof fetchCampaigns>>;
        ads: Awaited<ReturnType<typeof fetchAds>>;
      };
      let payload = getCached<BdPayload>(cacheKey) ?? await getDbCached<BdPayload>(cacheKey);
      if (!payload) {
        const [campaigns, ads] = await Promise.all([
          fetchCampaigns(meta_account_id, meta_access_token, dateFilter),
          fetchAds(meta_account_id, meta_access_token, dateFilter),
        ]);
        payload = { campaigns, ads };
        setCached(cacheKey, payload);
        setDbCached(cacheKey, payload);
      } else {
        setCached(cacheKey, payload);
      }
      return NextResponse.json({ campaigns: payload.campaigns, ads: payload.ads });
    }

    // ── Full (backward compat) ────────────────────────────────────────────────
    const cacheKey = `${accountId}:full:${dateKey}`;
    type FullPayload = {
      accountMetrics: Awaited<ReturnType<typeof fetchAccountInsights>>;
      comparisonMetrics: Awaited<ReturnType<typeof fetchAccountInsights>>;
      campaigns: Awaited<ReturnType<typeof fetchCampaigns>>;
      ads: Awaited<ReturnType<typeof fetchAds>>;
    };
    let metaPayload = getCached<FullPayload>(cacheKey) ?? await getDbCached<FullPayload>(cacheKey);
    if (!metaPayload) {
      const comparisonFilter = getMonthComparisonFilter(dateFilter) ?? estimateComparisonFilter(dateFilter);
      const [accountMetrics, comparisonMetrics, campaigns, ads] = await Promise.all([
        fetchAccountInsights(meta_account_id, meta_access_token, dateFilter),
        fetchAccountInsights(meta_account_id, meta_access_token, comparisonFilter),
        fetchCampaigns(meta_account_id, meta_access_token, dateFilter),
        fetchAds(meta_account_id, meta_access_token, dateFilter),
      ]);
      metaPayload = { accountMetrics, comparisonMetrics, campaigns, ads };
      setCached(cacheKey, metaPayload);
      setDbCached(cacheKey, metaPayload);
    } else {
      setCached(cacheKey, metaPayload);
    }

    return NextResponse.json({
      id: client.id,
      name: client.name,
      meta_account_id,
      client_type: (client.client_type as "ecommerce" | "servicios") ?? "ecommerce",
      thresholds: threshold,
      ...metaPayload,
    });
  } catch (err) {
    console.error("[API /meta/[accountId]]", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
