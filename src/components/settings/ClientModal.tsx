"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { createClientAction, updateClientAction } from "@/lib/actions/clients";
import type { ClientWithThresholds } from "@/types/client";

interface ClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientWithThresholds | null;
}

export function ClientModal({ open, onOpenChange, client }: ClientModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!client;
  const threshold = client?.client_thresholds?.[0];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEditing
        ? await updateClientAction(client.id, formData)
        : await createClientAction(formData);

      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEditing ? "Editar cliente" : "Registrar cliente"}
          </DialogTitle>
        </DialogHeader>

        <form
          key={client?.id ?? "new"}
          onSubmit={handleSubmit}
          className="space-y-4 pt-2"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del cliente</Label>
            <Input
              id="name"
              name="name"
              placeholder="Ej: Sara Accesorios"
              defaultValue={client?.name}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta_account_id">Meta Account ID</Label>
            <Input
              id="meta_account_id"
              name="meta_account_id"
              placeholder="act_XXXXXXXXXX"
              defaultValue={client?.meta_account_id}
              required
            />
            <p className="text-xs text-muted-foreground">
              Formato: act_ seguido del número de cuenta publicitaria.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta_access_token">Meta Access Token</Label>
            <Input
              id="meta_access_token"
              name="meta_access_token"
              type="password"
              placeholder="Token de acceso de Meta API"
              defaultValue={client?.meta_access_token}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="roas_min">ROAS mínimo</Label>
              <Input
                id="roas_min"
                name="roas_min"
                type="number"
                step="0.01"
                min="0"
                placeholder="2.00"
                defaultValue={threshold?.roas_min}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpa_max">CPA máximo</Label>
              <Input
                id="cpa_max"
                name="cpa_max"
                type="number"
                step="0.01"
                min="0"
                placeholder="15.00"
                defaultValue={threshold?.cpa_max}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales_min">Ventas mínimas</Label>
              <Input
                id="sales_min"
                name="sales_min"
                type="number"
                min="0"
                placeholder="50"
                defaultValue={threshold?.sales_min}
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-brand-500 hover:bg-brand-600 text-white"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Guardar cambios" : "Registrar cliente"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
