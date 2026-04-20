"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ExternalLink, TrendingUp } from "lucide-react";
import type { DashboardClientRow, DashboardGoals, DashboardProjected } from "@/app/api/dashboard/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fNum(value: number, decimals = 2) {
  return value.toFixed(decimals);
}

// For each metric: true = higher is better, false = lower is better
type MetricKey = "inversion" | "compras" | "cpa" | "roas" | "facturacion";

const HIGHER_IS_BETTER: Record<MetricKey, boolean> = {
  inversion: true,
  compras: true,
  cpa: false,
  roas: true,
  facturacion: true,
};

function isOnTrack(key: MetricKey, projected: number, goal: number): boolean {
  if (HIGHER_IS_BETTER[key]) return projected >= goal;
  return projected <= goal;
}

// ─── Metric row ───────────────────────────────────────────────────────────────

const METRICS: { key: MetricKey; label: string; format: (v: number) => string }[] = [
  { key: "inversion",   label: "Inversión",    format: fCurrency },
  { key: "compras",     label: "Compras",      format: v => String(Math.round(v)) },
  { key: "cpa",         label: "CPA",          format: fCurrency },
  { key: "roas",        label: "ROAS",         format: v => `${fNum(v)}x` },
  { key: "facturacion", label: "Facturación",  format: fCurrency },
];

interface MetricRowProps {
  goals: DashboardGoals | null;
  projected: DashboardProjected;
}

function MetricRows({ goals, projected }: MetricRowProps) {
  return (
    <div className="grid grid-cols-5 divide-x divide-border">
      {METRICS.map(({ key, format, label }) => {
        const goalRaw = goals?.[key as keyof DashboardGoals] as number | null | undefined;
        const projRaw = projected[key as keyof DashboardProjected];
        const hasGoal = goalRaw != null && goalRaw > 0;
        const onTrack = hasGoal ? isOnTrack(key, projRaw, goalRaw!) : null;

        const projTextStyle =
          onTrack === null
            ? "text-foreground"
            : onTrack
            ? "text-emerald-400"
            : "text-red-400";

        const projBgStyle =
          onTrack === null
            ? ""
            : onTrack
            ? "bg-emerald-500/5"
            : "bg-red-500/5";

        return (
          <div key={key} className="flex flex-col">
            {/* Column header */}
            <div className="px-6 pt-5 pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {label}
              </span>
            </div>

            {/* Goal */}
            <div className="px-6 pb-4 border-b border-border">
              <p className="text-[11px] text-muted-foreground/60 mb-1 uppercase tracking-wide font-medium">
                Objetivo
              </p>
              <p className="text-lg font-semibold text-muted-foreground">
                {hasGoal ? format(goalRaw!) : "—"}
              </p>
            </div>

            {/* Projected */}
            <div className={`px-6 py-4 flex-1 ${projBgStyle}`}>
              <p className="text-[11px] text-muted-foreground/60 mb-1 uppercase tracking-wide font-medium">
                Proyectado
              </p>
              <p className={`text-xl font-bold ${projTextStyle}`}>
                {format(projRaw)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Client card ──────────────────────────────────────────────────────────────

function ClientCard({ client }: { client: DashboardClientRow }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10">
            <TrendingUp className="h-4 w-4 text-brand-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">{client.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {MONTH_NAMES[client.month - 1]} {client.year}
            </p>
          </div>
        </div>
        <Link
          href={`/clients/${client.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors border border-border"
        >
          Ver detalle
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Metrics */}
      <div className="border-t border-border">
        {client.projected === null ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Sin datos de Meta este mes.
          </div>
        ) : (
          <MetricRows goals={client.goals} projected={client.projected} />
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonClientCard() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        </div>
        <div className="h-7 w-24 bg-muted rounded-lg" />
      </div>
      <div className="border-t border-border grid grid-cols-5 divide-x divide-border">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-6 py-5 space-y-3">
            <div className="h-3 w-14 bg-muted rounded" />
            <div className="h-5 w-20 bg-muted rounded" />
            <div className="border-t border-border pt-3 space-y-2">
              <div className="h-3 w-14 bg-muted rounded" />
              <div className="h-6 w-24 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [clients, setClients] = useState<DashboardClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Error al cargar los datos.");
      const data = await res.json();
      setClients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const now = new Date();
  const currentMonthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Proyección mensual · {currentMonthLabel}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Client cards */}
      <div className="space-y-6">
        {loading ? (
          <>
            <SkeletonClientCard />
            <SkeletonClientCard />
          </>
        ) : clients.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No hay clientes ecommerce asignados.
            </p>
          </div>
        ) : (
          clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))
        )}
      </div>
    </div>
  );
}
