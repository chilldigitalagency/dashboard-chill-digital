import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAccountInsights } from "@/lib/meta-ads/client";

// ─── Projection helpers ───────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function project(value: number, daysElapsed: number, totalDays: number): number {
  if (daysElapsed <= 0) return 0;
  return (value / daysElapsed) * totalDays;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardGoals {
  inversion: number | null;
  compras: number | null;
  cpa: number | null;
  roas: number | null;
  facturacion: number | null;
}

export interface DashboardProjected {
  inversion: number;
  compras: number;
  cpa: number;
  roas: number;
  facturacion: number;
}

export interface DashboardClientRow {
  id: string;
  name: string;
  current: {
    spend: number;
    purchases: number;
    revenue: number;
    roas: number;
    cpa: number;
  } | null;
  goals: DashboardGoals | null;
  projected: DashboardProjected | null;
  year: number;
  month: number;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // 1. Verify session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 2. Determine role
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const isAdmin = profile?.role === "admin";

    // 3. Fetch ecommerce clients
    type ClientRow = {
      id: string;
      name: string;
      meta_account_id: string;
      meta_access_token: string;
    };

    let clients: ClientRow[] = [];

    if (isAdmin) {
      const { data, error } = await admin
        .from("clients")
        .select("id, name, meta_account_id, meta_access_token")
        .eq("active", true)
        .eq("client_type", "ecommerce")
        .order("name");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      clients = (data ?? []) as ClientRow[];
    } else {
      const { data: accessRows } = await admin
        .from("client_user_access")
        .select("client_id")
        .eq("user_id", user.id);

      const clientIds = (accessRows ?? []).map((r: { client_id: string }) => r.client_id);
      if (clientIds.length === 0) return NextResponse.json([]);

      const { data, error } = await admin
        .from("clients")
        .select("id, name, meta_account_id, meta_access_token")
        .in("id", clientIds)
        .eq("active", true)
        .eq("client_type", "ecommerce")
        .order("name");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      clients = (data ?? []) as ClientRow[];
    }

    if (clients.length === 0) return NextResponse.json([]);

    // 4. Current month context
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    const daysElapsed = now.getDate();
    const totalDays = daysInMonth(year, month);

    // 5. Fetch Meta data (this_month) + goals for all clients in parallel
    const results = await Promise.all(
      clients.map(async (client) => {
        const [metaData, goalsResult] = await Promise.all([
          fetchAccountInsights(
            client.meta_account_id,
            client.meta_access_token,
            { type: "preset", preset: "this_month" }
          ),
          admin
            .from("client_monthly_goals")
            .select("inversion, compras, cpa, roas, facturacion")
            .eq("client_id", client.id)
            .eq("year", year)
            .eq("month", month)
            .maybeSingle(),
        ]);

        const goals = (goalsResult.data as DashboardGoals | null) ?? null;

        let current = null;
        let projected: DashboardProjected | null = null;

        if (metaData) {
          const { spend, purchases, revenue } = metaData;
          const roas = spend > 0 ? revenue / spend : 0;
          const cpa = purchases > 0 ? spend / purchases : 0;
          current = { spend, purchases, revenue, roas, cpa };

          const projSpend = project(spend, daysElapsed, totalDays);
          const projPurchases = project(purchases, daysElapsed, totalDays);
          const projRevenue = project(revenue, daysElapsed, totalDays);
          const projRoas = projSpend > 0 ? projRevenue / projSpend : 0;
          const projCpa = projPurchases > 0 ? projSpend / projPurchases : 0;

          projected = {
            inversion: projSpend,
            compras: projPurchases,
            cpa: projCpa,
            roas: projRoas,
            facturacion: projRevenue,
          };
        }

        return {
          id: client.id,
          name: client.name,
          current,
          goals,
          projected,
          year,
          month,
        } satisfies DashboardClientRow;
      })
    );

    return NextResponse.json(results);
  } catch (err) {
    console.error("[API /dashboard]", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
