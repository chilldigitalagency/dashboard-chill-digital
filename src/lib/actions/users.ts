"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateUserAccessAction(
  userId: string,
  clientIds: string[]
) {
  const supabase = createAdminClient();

  const { error: deleteError } = await supabase
    .from("client_user_access")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (clientIds.length > 0) {
    const rows = clientIds.map((client_id) => ({ client_id, user_id: userId }));

    const { error: insertError } = await supabase
      .from("client_user_access")
      .insert(rows);

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath("/settings");
  return { success: true };
}
