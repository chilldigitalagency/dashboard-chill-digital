"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { updateUserAccessAction } from "@/lib/actions/users";
import type { Client } from "@/types/client";
import type { ProfileWithEmail } from "@/types/profile";

interface UserAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileWithEmail;
  allClients: Client[];
  currentClientIds: string[];
}

export function UserAccessModal({
  open,
  onOpenChange,
  user,
  allClients,
  currentClientIds,
}: UserAccessModalProps) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(currentClientIds);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar cuando cambia el usuario abierto
  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      setSelected(currentClientIds);
      setError(null);
    }
    onOpenChange(isOpen);
  }

  function toggleClient(clientId: string) {
    setSelected((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateUserAccessAction(user.id, selected);
      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
      }
    });
  }

  const activeClients = allClients.filter((c) => c.active);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Gestionar acceso
          </DialogTitle>
          <DialogDescription>
            {user.full_name ?? user.email} — Seleccioná los clientes que puede
            ver.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {activeClients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay clientes activos registrados.
            </p>
          ) : (
            <ScrollArea className="max-h-72">
              <div className="space-y-1 pr-2">
                {activeClients.map((client) => (
                  <label
                    key={client.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={selected.includes(client.id)}
                      onCheckedChange={() => toggleClient(client.id)}
                      className="border-border data-[state=checked]:bg-brand-500 data-[state=checked]:border-brand-500"
                    />
                    <span className="text-sm text-foreground font-medium">
                      {client.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {client.meta_account_id}
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-between items-center pt-2">
          <p className="text-xs text-muted-foreground">
            {selected.length} cliente{selected.length !== 1 ? "s" : ""}{" "}
            seleccionado{selected.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="bg-brand-500 hover:bg-brand-600 text-white"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar acceso
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
