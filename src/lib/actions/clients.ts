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
  const roas_min = parseFloat(formData.get("roas_min") as string);
  const cpa_max = parseFloat(formData.get("cpa_max") as string);
  const sales_min = parseInt(formData.get("sales_min") as string, 10);

  if (!name || !meta_account_id || !meta_access_token) {
    return { error: "Todos los campos son obligatorios." };
  }

  const slug = generateSlug(name);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({ name, slug, meta_account_id, meta_access_token })
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
  return { success: true };
}

export async function updateClientAction(id: string, formData: FormData) {
  const supabase = createAdminClient();

  const name = (formData.get("name") as string).trim();
  const meta_account_id = (formData.get("meta_account_id") as string).trim();
  const meta_access_token = (formData.get("meta_access_token") as string).trim();
  const roas_min = parseFloat(formData.get("roas_min") as string);
  const cpa_max = parseFloat(formData.get("cpa_max") as string);
  const sales_min = parseInt(formData.get("sales_min") as string, 10);

  if (!name || !meta_account_id || !meta_access_token) {
    return { error: "Todos los campos son obligatorios." };
  }

  const { error: clientError } = await supabase
    .from("clients")
    .update({ name, meta_account_id, meta_access_token })
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
