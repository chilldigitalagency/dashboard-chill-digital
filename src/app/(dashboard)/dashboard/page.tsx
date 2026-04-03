"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, ShoppingCart, DollarSign, BarChart2, ExternalLink } from "lucide-react";
import { TH, useResizableCols } from "@/components/ui/resizable-table-head";
import type { SortDir } from "@/components/ui/resizable-table-head";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientMetrics {
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  reach: number;
  impressions: number;
  frequency: number;
  clicks: number;
}

interface ClientRow {
  id: string;
  name: string;
  meta_account_id: string;
  metrics: ClientMetrics | null;
  thresholds: { roas_min: number; cpa_max: number; sales_min: number } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { label: "Últimos 7 días", value: "last_7d" },
  { label: "Últimos 14 días", value: "last_14d" },
  { label: "Últimos 30 días", value: "last_30d" },
  { label: "Mes actual", value: "this_month" },
] as const;

type DatePreset = (typeof DATE_PRESETS)[number]["value"];

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

function calcStatus(metrics: ClientMetrics, thresholds: ClientRow["thresholds"]) {
  if (!thresholds) return "seguimiento";
  const { roas_min, cpa_max, sales_min } = thresholds;
  const roasOk = metrics.roas >= roas_min;
  const cpaOk = cpa_max === 0 || metrics.cpa <= cpa_max;
  const purchasesOk = metrics.purchases >= sales_min;
  if (roasOk && cpaOk && purchasesOk) return "excelente";
  if (!roasOk && !cpaOk) return "apagar";
  return "seguimiento";
}

function StatusBadge({ metrics, thresholds }: { metrics: ClientMetrics | null; thresholds: ClientRow["thresholds"] }) {
  if (!metrics) {
    return <Badge variant="outline">Sin datos</Badge>;
  }
  const status = calcStatus(metrics, thresholds);
  if (status === "excelente") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15">
        Gran rendimiento
      </Badge>
    );
  }
  if (status === "apagar") {
    return <Badge variant="destructive">Apagar</Badge>;
  }
  return <Badge variant="secondary">Seguimiento</Badge>;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
      <div className="h-4 w-32 bg-muted rounded mb-4" />
      <div className="h-7 w-24 bg-muted rounded" />
    </div>
  );
}

function SkeletonRow() {
  return (
    <TableRow>
      {[...Array(7)].map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 bg-muted rounded animate-pulse w-20" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ─── Summary cards ────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
}

function SummaryCard({ label, value, icon: Icon }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-muted-foreground mb-3">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// ─── Table sort & resize ──────────────────────────────────────────────────────

type DashboardSortKey = "spend" | "roas" | "cpa" | "purchases";

const COL_WIDTHS: Record<string, number> = {
  cliente: 250, spend: 160, roas: 140, cpa: 140, purchases: 140, estado: 160, acciones: 140,
};

function getSortValue(client: ClientRow, key: DashboardSortKey): number {
  const m = client.metrics;
  if (!m) return -Infinity;
  return m[key] ?? 0;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [datePreset, setDatePreset] = useState<DatePreset>("last_7d");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<DashboardSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { colWidths, handleResizeStart, totalWidth } = useResizableCols(COL_WIDTHS);

  function handleSort(key: DashboardSortKey) {
    if (sortKey === key) {
      if (sortDir === "desc") setSortDir("asc");
      else { setSortKey(null); setSortDir("desc"); }
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortedClients = useMemo(() => {
    if (!sortKey) return clients;
    return [...clients].sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [clients, sortKey, sortDir]);

  const fetchData = useCallback(async (preset: DatePreset) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/meta/accounts?datePreset=${preset}`);
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
    fetchData(datePreset);
  }, [datePreset, fetchData]);

  // Summary totals
  const totals = clients.reduce(
    (acc, client) => {
      if (!client.metrics) return acc;
      acc.spend += client.metrics.spend;
      acc.purchases += client.metrics.purchases;
      acc.revenue += client.metrics.revenue;
      return acc;
    },
    { spend: 0, purchases: 0, revenue: 0 }
  );
  const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const avgCpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;

  return (
    <div className="px-8 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Vista general de todos los clientes</p>
        </div>

        {/* Date preset selector */}
        <div className="flex items-center gap-1 bg-muted/50 border border-border rounded-lg p-1">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => setDatePreset(preset.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                datePreset === preset.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <SummaryCard label="Total invertido" value={fCurrency(totals.spend)} icon={DollarSign} />
            <SummaryCard label="ROAS promedio" value={`${fNum(avgRoas)}x`} icon={TrendingUp} />
            <SummaryCard label="Compras totales" value={String(Math.round(totals.purchases))} icon={ShoppingCart} />
            <SummaryCard label="CPA promedio" value={avgCpa > 0 ? fCurrency(avgCpa) : "—"} icon={BarChart2} />
          </>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table className="table-fixed" style={{ width: totalWidth }}>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TH colKey="cliente" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.cliente} onResizeStart={(e) => handleResizeStart(e, "cliente")}>Cliente</TH>
              <TH colKey="spend" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.spend} onSort={() => handleSort("spend")} onResizeStart={(e) => handleResizeStart(e, "spend")}>Inversión</TH>
              <TH colKey="roas" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.roas} onSort={() => handleSort("roas")} onResizeStart={(e) => handleResizeStart(e, "roas")}>ROAS</TH>
              <TH colKey="cpa" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.cpa} onSort={() => handleSort("cpa")} onResizeStart={(e) => handleResizeStart(e, "cpa")}>CPA</TH>
              <TH colKey="purchases" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.purchases} onSort={() => handleSort("purchases")} onResizeStart={(e) => handleResizeStart(e, "purchases")}>Compras</TH>
              <TH colKey="estado" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.estado} onResizeStart={(e) => handleResizeStart(e, "estado")}>Estado</TH>
              <TH colKey="acciones" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.acciones} onResizeStart={(e) => handleResizeStart(e, "acciones")}>Acciones</TH>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : sortedClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  No hay clientes asignados.
                </TableCell>
              </TableRow>
            ) : (
              sortedClients.map((client) => (
                <TableRow key={client.id} className="border-border">
                  <TableCell className="font-medium text-foreground">
                    {client.name}
                  </TableCell>
                  <TableCell className="text-right text-foreground tabular-nums">
                    {client.metrics ? fCurrency(client.metrics.spend) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-foreground tabular-nums">
                    {client.metrics ? `${fNum(client.metrics.roas)}x` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-foreground tabular-nums">
                    {client.metrics && client.metrics.cpa > 0
                      ? fCurrency(client.metrics.cpa)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-foreground tabular-nums">
                    {client.metrics ? Math.round(client.metrics.purchases) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge metrics={client.metrics} thresholds={client.thresholds} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                      Ver detalle
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
