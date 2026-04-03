import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAccountInsights,
  fetchCampaigns,
  fetchAds,
} from "@/lib/meta-ads/client";
import type { DateFilter } from "@/lib/meta-ads/client";

// ─── In-memory cache (5 min TTL) ─────────────────────────────────────────────
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data as T;
}
function setCached(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

const VALID_PRESETS = [
  "today", "yesterday", "last_7d", "last_14d", "last_30d",
  "this_month", "last_month",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: { accountId: string } }
) {
  try {
  // 1. Verificar sesión
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = params;
  const sp = request.nextUrl.searchParams;
  const since = sp.get("since");
  const until = sp.get("until");
  const presetParam = sp.get("datePreset") ?? "last_7d";

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

  // 2. Verificar que el usuario tiene acceso a este cliente
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    const { data: access } = await admin
      .from("client_user_access")
      .select("client_id")
      .eq("user_id", user.id)
      .eq("client_id", accountId)
      .single();

    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // 3. Obtener datos del cliente (meta_account_id + token)
  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id, name, meta_account_id, meta_access_token, client_thresholds(roas_min, cpa_max, sales_min)")
    .eq("id", accountId)
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const { meta_account_id, meta_access_token } = client;

  // 4. Llamar a Meta API en paralelo (con caché de 5 min)
  const cacheKey = `${accountId}:${since ?? presetParam}:${until ?? ""}`;
  type MetaPayload = { accountMetrics: Awaited<ReturnType<typeof fetchAccountInsights>>; campaigns: Awaited<ReturnType<typeof fetchCampaigns>>; ads: Awaited<ReturnType<typeof fetchAds>> };
  let metaPayload = getCached<MetaPayload>(cacheKey);

  if (!metaPayload) {
    const [accountMetrics, campaigns, ads] = await Promise.all([
      fetchAccountInsights(meta_account_id, meta_access_token, dateFilter),
      fetchCampaigns(meta_account_id, meta_access_token, dateFilter),
      fetchAds(meta_account_id, meta_access_token, dateFilter),
    ]);
    metaPayload = { accountMetrics, campaigns, ads };
    setCached(cacheKey, metaPayload);
  }

  const { accountMetrics, campaigns, ads } = metaPayload;

  // 5. Retornar datos consolidados
  const threshold = (client.client_thresholds as { roas_min: number; cpa_max: number; sales_min: number }[])?.[0] ?? null;

  return NextResponse.json({
    id: client.id,
    name: client.name,
    meta_account_id,
    thresholds: threshold,
    accountMetrics,
    campaigns,
    ads,
  });
  } catch (err) {
    console.error("[API /meta/[accountId]]", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
