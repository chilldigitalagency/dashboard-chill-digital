import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMetaAds } from "@/lib/meta-ads/client";

const VALID_DATE_PRESETS = ["last_7d", "last_14d", "last_30d", "this_month"];

export async function GET(request: NextRequest) {
  // 1. Verificar sesión
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const datePreset = request.nextUrl.searchParams.get("datePreset") ?? "last_7d";
  if (!VALID_DATE_PRESETS.includes(datePreset)) {
    return NextResponse.json({ error: "Invalid datePreset" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 2. Determinar rol del usuario
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // 3. Obtener clientes según rol
  let clients: {
    id: string;
    name: string;
    meta_account_id: string;
    meta_access_token: string;
    client_thresholds: { roas_min: number; cpa_max: number; sales_min: number }[];
  }[] = [];

  if (isAdmin) {
    const { data, error } = await admin
      .from("clients")
      .select("id, name, meta_account_id, meta_access_token, client_thresholds(roas_min, cpa_max, sales_min)")
      .eq("active", true)
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    clients = (data ?? []) as typeof clients;
  } else {
    const { data: accessRows, error: accessError } = await admin
      .from("client_user_access")
      .select("client_id")
      .eq("user_id", user.id);

    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 });
    }

    const clientIds = (accessRows ?? []).map((r) => r.client_id);

    if (clientIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data, error } = await admin
      .from("clients")
      .select("id, name, meta_account_id, meta_access_token, client_thresholds(roas_min, cpa_max, sales_min)")
      .in("id", clientIds)
      .eq("active", true)
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    clients = (data ?? []) as typeof clients;
  }

  // 4. Llamar a Meta Ads API en paralelo para cada cliente
  const results = await Promise.all(
    clients.map(async (client) => {
      const metrics = await fetchMetaAds(
        client.meta_account_id,
        client.meta_access_token,
        datePreset
      );

      const threshold = client.client_thresholds?.[0];

      return {
        id: client.id,
        name: client.name,
        meta_account_id: client.meta_account_id,
        metrics,
        thresholds: threshold
          ? {
              roas_min: threshold.roas_min,
              cpa_max: threshold.cpa_max,
              sales_min: threshold.sales_min,
            }
          : null,
      };
    })
  );

  return NextResponse.json(results);
}
