"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getMonthlyGoalsAction,
  upsertMonthlyGoalsAction,
} from "@/lib/actions/clients";
import type { ClientWithThresholds } from "@/types/client";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface ClientGoalsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientWithThresholds;
}

export function ClientGoalsModal({ open, onOpenChange, client }: ClientGoalsModalProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Default form values for the selected month
  const [defaults, setDefaults] = useState<{
    inversion: string;
    compras: string;
    cpa: string;
    roas: string;
    facturacion: string;
  }>({ inversion: "", compras: "", cpa: "", roas: "", facturacion: "" });

  // Load goals when month/year changes
  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    getMonthlyGoalsAction(client.id, year, month).then(({ data }) => {
      setDefaults({
        inversion: data?.inversion != null ? String(data.inversion) : "",
        compras: data?.compras != null ? String(data.compras) : "",
        cpa: data?.cpa != null ? String(data.cpa) : "",
        roas: data?.roas != null ? String(data.roas) : "",
        facturacion: data?.facturacion != null ? String(data.facturacion) : "",
      });
      setIsLoading(false);
    });
  }, [client.id, year, month, open]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await upsertMonthlyGoalsAction(client.id, year, month, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Objetivos mensuales — {client.name}
          </DialogTitle>
        </DialogHeader>

        {/* Month navigator */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2.5">
          <button
            type="button"
            onClick={prevMonth}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1 rounded"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-1 rounded"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form key={`${client.id}-${year}-${month}`} onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="goal_inversion">Inversión ($)</Label>
                <Input
                  id="goal_inversion"
                  name="inversion"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  defaultValue={defaults.inversion}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal_compras">Compras</Label>
                <Input
                  id="goal_compras"
                  name="compras"
                  type="number"
                  min="0"
                  placeholder="0"
                  defaultValue={defaults.compras}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal_cpa">CPA ($)</Label>
                <Input
                  id="goal_cpa"
                  name="cpa"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  defaultValue={defaults.cpa}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal_roas">ROAS</Label>
                <Input
                  id="goal_roas"
                  name="roas"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  defaultValue={defaults.roas}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="goal_facturacion">Facturación ($)</Label>
                <Input
                  id="goal_facturacion"
                  name="facturacion"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  defaultValue={defaults.facturacion}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
                Objetivos guardados correctamente.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cerrar
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-brand-500 hover:bg-brand-600 text-white"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar objetivos
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
