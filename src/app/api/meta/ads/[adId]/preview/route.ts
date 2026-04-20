import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const META_API_BASE = "https://graph.facebook.com/v21.0";

const FORMATS = [
  "INSTAGRAM_STANDARD",
  "INSTAGRAM_STORY",
];

export async function GET(
  request: NextRequest,
  { params }: { params: { adId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { adId } = params;
    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId requerido" }, { status: 400 });

    const admin = createAdminClient();

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

    const { data: client, error } = await admin
      .from("clients")
      .select("meta_access_token")
      .eq("id", clientId)
      .single();

    if (error || !client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    // Fetch all formats in parallel
    const results = await Promise.all(
      FORMATS.map(async (format) => {
        const p = new URLSearchParams({ ad_format: format, access_token: client.meta_access_token });
        const res = await fetch(`${META_API_BASE}/${adId}/previews?${p.toString()}`, { cache: "no-store" });
        const json = await res.json() as { data?: { body: string; ad_format: string }[]; error?: { message: string } };
        if (!res.ok || json.error || !json.data?.[0]) return null;
        return { format, html: json.data[0].body };
      })
    );

    const previews = results.filter(Boolean) as { format: string; html: string }[];
    return NextResponse.json({ previews });
  } catch (err) {
    console.error("[API /meta/ads/preview]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
