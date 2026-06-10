import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // Fetch clients for sidebar quick-navigation
  let clientsForNav: { id: string; name: string }[] = [];
  if (isAdmin) {
    const { data } = await admin
      .from("clients")
      .select("id, name")
      .eq("active", true)
      .order("name");
    clientsForNav = (data ?? []) as { id: string; name: string }[];
  } else {
    const { data: accessList } = await admin
      .from("client_user_access")
      .select("client_id")
      .eq("user_id", user.id);
    const ids = (accessList ?? []).map((a: { client_id: string }) => a.client_id);
    if (ids.length > 0) {
      const { data } = await admin
        .from("clients")
        .select("id, name")
        .in("id", ids)
        .eq("active", true)
        .order("name");
      clientsForNav = (data ?? []) as { id: string; name: string }[];
    }
  }

  return (
    <DashboardShell
      sidebarData={{
        userName: profile?.full_name ?? user.email ?? "Usuario",
        userEmail: user.email ?? "",
        isAdmin,
        clients: clientsForNav,
      }}
    >
      {children}
    </DashboardShell>
  );
}
