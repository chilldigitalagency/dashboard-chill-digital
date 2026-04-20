import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchDailyInsights } from "@/lib/meta-ads/client";
import type { DateFilter } from "@/lib/meta-ads/client";

const VALID_PRESETS = ["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month", "last_month"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

    let dateFilter: DateFilter;
    if (since && until) {
      if (!ISO_DATE.test(since) || !ISO_DATE.test(until))
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
      dateFilter = { type: "custom", since, until };
    } else {
      if (!VALID_PRESETS.includes(presetParam))
        return NextResponse.json({ error: "Invalid datePreset" }, { status: 400 });
      dateFilter = { type: "preset", preset: presetParam };
    }

    const admin = createAdminClient();

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    if (!isAdmin) {
      const { data: access } = await admin
        .from("client_user_access")
        .select("client_id")
        .eq("user_id", user.id)
        .eq("client_id", accountId)
        .single();
      if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: client, error } = await admin
      .from("clients")
      .select("meta_account_id, meta_access_token")
      .eq("id", accountId)
      .single();

    if (error || !client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    const data = await fetchDailyInsights(client.meta_account_id, client.meta_access_token, dateFilter);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API /daily]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
