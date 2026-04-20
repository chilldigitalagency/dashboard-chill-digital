import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const META_API_BASE = "https://graph.facebook.com/v21.0";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { adId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { adId } = params;
    const body = await request.json() as { status: "ACTIVE" | "PAUSED"; clientId: string };
    const { status, clientId } = body;

    if (!["ACTIVE", "PAUSED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify access
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    if (!isAdmin) {
      const { data: access } = await admin
        .from("client_user_access")
        .select("client_id")
        .eq("user_id", user.id)
        .eq("client_id", clientId)
        .single();
      if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get access token
    const { data: client, error } = await admin
      .from("clients")
      .select("meta_access_token")
      .eq("id", clientId)
      .single();

    if (error || !client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    // Call Meta API
    const params2 = new URLSearchParams({
      status,
      access_token: client.meta_access_token,
    });
    const res = await fetch(`${META_API_BASE}/${adId}?${params2.toString()}`, {
      method: "POST",
      cache: "no-store",
    });
    const json = await res.json() as { success?: boolean; error?: { message: string } };

    if (!res.ok || json.error) {
      console.error("[Meta] toggle ad error:", json.error?.message);
      return NextResponse.json({ error: json.error?.message ?? "Error de Meta API" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[API /meta/ads/[adId]]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
