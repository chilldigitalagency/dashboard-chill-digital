"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientsSection } from "@/components/settings/ClientsSection";
import { UsersSection } from "@/components/settings/UsersSection";
import type { ClientWithThresholds } from "@/types/client";
import type { ProfileWithEmail } from "@/types/profile";

interface SettingsTabsProps {
  clients: ClientWithThresholds[];
  users: ProfileWithEmail[];
  accessByUser: Record<string, string[]>;
}

export function SettingsTabs({
  clients,
  users,
  accessByUser,
}: SettingsTabsProps) {
  return (
    <Tabs defaultValue="clients" className="w-full">
      <TabsList className="bg-card border border-border h-10 p-1 mb-6">
        <TabsTrigger
          value="clients"
          className="data-[state=active]:bg-brand-500 data-[state=active]:text-white text-muted-foreground"
        >
          Clientes
        </TabsTrigger>
        <TabsTrigger
          value="users"
          className="data-[state=active]:bg-brand-500 data-[state=active]:text-white text-muted-foreground"
        >
          Usuarios
        </TabsTrigger>
      </TabsList>

      <TabsContent value="clients" className="mt-0">
        <ClientsSection clients={clients} />
      </TabsContent>

      <TabsContent value="users" className="mt-0">
        <UsersSection
          users={users}
          allClients={clients}
          accessByUser={accessByUser}
        />
      </TabsContent>
    </Tabs>
  );
}
