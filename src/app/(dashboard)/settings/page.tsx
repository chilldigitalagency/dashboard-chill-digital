import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import type { ClientWithThresholds } from "@/types/client";
import type { ProfileWithEmail } from "@/types/profile";

export const metadata = {
  title: "Configuración — Chill Digital Dashboard",
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const adminClient = createAdminClient();

  const { data: currentProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentProfile?.role !== "admin") {
    redirect("/dashboard");
  }

  // Fetch paralelo de todos los datos necesarios
  const [
    { data: clientsData },
    { data: profilesData },
    { data: accessData },
    authUsersResult,
  ] = await Promise.all([
    adminClient
      .from("clients")
      .select("*, client_thresholds(*)")
      .order("name"),
    adminClient.from("profiles").select("*").order("created_at"),
    adminClient.from("client_user_access").select("client_id, user_id"),
    adminClient.auth.admin.listUsers().catch(() => ({
      data: { users: [] },
    })),
  ]);

  const clients = (clientsData ?? []) as ClientWithThresholds[];
  const profiles = profilesData ?? [];
  const accessRecords = accessData ?? [];
  const authUsers =
    "data" in authUsersResult ? (authUsersResult.data?.users ?? []) : [];

  const users: ProfileWithEmail[] = profiles.map((profile) => ({
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
    created_at: profile.created_at,
    email:
      authUsers.find((u) => u.id === profile.id)?.email ?? "Sin email",
  }));

  const accessByUser = accessRecords.reduce<Record<string, string[]>>(
    (acc, record) => {
      if (!acc[record.user_id]) acc[record.user_id] = [];
      acc[record.user_id].push(record.client_id);
      return acc;
    },
    {}
  );

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-muted-foreground mt-1">
          Administrá clientes, umbrales de performance y accesos del equipo.
        </p>
      </div>

      <SettingsTabs
        clients={clients}
        users={users}
        accessByUser={accessByUser}
      />
    </div>
  );
}
