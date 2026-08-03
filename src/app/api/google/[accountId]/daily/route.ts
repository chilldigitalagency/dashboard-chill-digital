import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleDaily } from "@/lib/google-ads/client";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fmt(d: Date) {
  return d.toISOString().split("T")[0];
}

function resolveDates(sp: URLSearchParams): { since: string; until: string } | null {
  const since = sp.get("since");
  const until = sp.get("until");
  const preset = sp.get("datePreset") ?? "last_7d";

  if (since && until) {
    if (!ISO_DATE.test(since) || !ISO_DATE.test(until)) return null;
    return { since, until };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (preset === "today") return { since: fmt(today), until: fmt(today) };
  if (preset === "yesterday") return { since: fmt(yesterday), until: fmt(yesterday) };

  if (preset === "this_month") {
    return {
      since: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
      until: fmt(today),
    };
  }
  if (preset === "last_month") {
    const y = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const m = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
    return {
      since: fmt(new Date(y, m, 1)),
      until: fmt(new Date(y, m + 1, 0)),
    };
  }

  const days =
    preset === "last_7d" ? 7 :
    preset === "last_14d" ? 14 :
    preset === "last_30d" ? 30 : 7;

  const prevUntil = new Date(yesterday);
  const prevSince = new Date(yesterday);
  prevSince.setDate(prevSince.getDate() - days + 1);
  return { since: fmt(prevSince), until: fmt(prevUntil) };
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
    const dates = resolveDates(sp);
    if (!dates) return NextResponse.json({ error: "Invalid date params" }, { status: 400 });

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

    const { data: client } = await admin
      .from("clients")
      .select("id, google_ads_access_token")
      .eq("id", accountId)
      .single();

    if (!client?.google_ads_access_token) {
      return NextResponse.json({ error: "Este cliente no tiene Google Ads configurado" }, { status: 404 });
    }

    const rows = await getGoogleDaily(client.google_ads_access_token, dates.since, dates.until);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[API /google/[accountId]/daily]", err);
    return NextResponse.json({ error: "Error al obtener datos diarios de Google Ads" }, { status: 500 });
  }
}
