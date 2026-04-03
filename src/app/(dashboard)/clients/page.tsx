import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientCard } from "@/components/clients/ClientCard";

export const metadata = {
  title: "Clientes — Chill Digital Dashboard",
};

export default async function ClientsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  let clients: { id: string; name: string; meta_account_id: string }[] = [];

  if (isAdmin) {
    const { data } = await admin
      .from("clients")
      .select("id, name, meta_account_id")
      .eq("active", true)
      .order("name");
    clients = data ?? [];
  } else {
    const { data: accessRows } = await admin
      .from("client_user_access")
      .select("client_id")
      .eq("user_id", user.id);

    const clientIds = (accessRows ?? []).map((r) => r.client_id);

    if (clientIds.length > 0) {
      const { data } = await admin
        .from("clients")
        .select("id, name, meta_account_id")
        .in("id", clientIds)
        .eq("active", true)
        .order("name");
      clients = data ?? [];
    }
  }

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <p className="text-muted-foreground mt-1">
          Seleccioná un cliente para ver sus resultados
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground text-sm">
            No tenés clientes asignados aún.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <ClientCard key={client.id} id={client.id} name={client.name} meta_account_id={client.meta_account_id} />
          ))}
        </div>
      )}
    </div>
  );
}
