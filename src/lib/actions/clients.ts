"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .trim();
}

export async function createClientAction(formData: FormData) {
  const supabase = createAdminClient();

  const name = (formData.get("name") as string).trim();
  const meta_account_id = (formData.get("meta_account_id") as string).trim();
  const meta_access_token = (formData.get("meta_access_token") as string).trim();
  const client_type = (formData.get("client_type") as string) === "servicios" ? "servicios" : "ecommerce";
  const roas_min = parseFloat(formData.get("roas_min") as string) || 0;
  const cpa_max = parseFloat(formData.get("cpa_max") as string) || 0;
  const sales_min = parseInt(formData.get("sales_min") as string, 10) || 0;

  if (!name || !meta_account_id || !meta_access_token) {
    return { error: "Todos los campos son obligatorios." };
  }

  const slug = generateSlug(name);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({ name, slug, meta_account_id, meta_access_token, client_type })
    .select()
    .single();

  if (clientError) {
    if (clientError.code === "23505") {
      return { error: "Ya existe un cliente con ese nombre." };
    }
    return { error: clientError.message };
  }

  const { error: thresholdError } = await supabase
    .from("client_thresholds")
    .insert({ client_id: client.id, roas_min, cpa_max, sales_min });

  if (thresholdError) {
    return { error: thresholdError.message };
  }

  revalidatePath("/settings");
  return { success: true, id: client.id };
}

export async function updateClientAction(id: string, formData: FormData) {
  const supabase = createAdminClient();

  const name = (formData.get("name") as string).trim();
  const meta_account_id = (formData.get("meta_account_id") as string).trim();
  const meta_access_token = (formData.get("meta_access_token") as string).trim();
  const client_type = (formData.get("client_type") as string) === "servicios" ? "servicios" : "ecommerce";
  const roas_min = parseFloat(formData.get("roas_min") as string) || 0;
  const cpa_max = parseFloat(formData.get("cpa_max") as string) || 0;
  const sales_min = parseInt(formData.get("sales_min") as string, 10) || 0;

  if (!name || !meta_account_id || !meta_access_token) {
    return { error: "Todos los campos son obligatorios." };
  }

  const { error: clientError } = await supabase
    .from("clients")
    .update({ name, meta_account_id, meta_access_token, client_type })
    .eq("id", id);

  if (clientError) {
    return { error: clientError.message };
  }

  const { error: thresholdError } = await supabase
    .from("client_thresholds")
    .update({ roas_min, cpa_max, sales_min })
    .eq("client_id", id);

  if (thresholdError) {
    return { error: thresholdError.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function deleteClientAction(id: string): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─── Monthly goals ────────────────────────────────────────────────────────────

export interface MonthlyGoals {
  inversion: number | null;
  compras: number | null;
  cpa: number | null;
  roas: number | null;
  facturacion: number | null;
}

export async function getMonthlyGoalsAction(
  clientId: string,
  year: number,
  month: number
): Promise<{ data: MonthlyGoals | null; error: string | null }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("client_monthly_goals")
    .select("inversion, compras, cpa, roas, facturacion")
    .eq("client_id", clientId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as MonthlyGoals | null, error: null };
}

export async function upsertMonthlyGoalsAction(
  clientId: string,
  year: number,
  month: number,
  formData: FormData
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createAdminClient();

  const parseFloat2 = (key: string) => {
    const val = parseFloat(formData.get(key) as string);
    return isNaN(val) ? null : val;
  };
  const parseInt2 = (key: string) => {
    const val = Number.parseInt(formData.get(key) as string, 10);
    return isNaN(val) ? null : val;
  };

  const payload = {
    client_id: clientId,
    year,
    month,
    inversion: parseFloat2("inversion"),
    compras: parseInt2("compras"),
    cpa: parseFloat2("cpa"),
    roas: parseFloat2("roas"),
    facturacion: parseFloat2("facturacion"),
  };

  const { error } = await supabase
    .from("client_monthly_goals")
    .upsert(payload, { onConflict: "client_id,year,month" });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}
