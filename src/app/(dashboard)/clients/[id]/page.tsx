"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TH, useResizableCols } from "@/components/ui/resizable-table-head";
import type { SortDir } from "@/components/ui/resizable-table-head";
import { DateRangePicker } from "@/components/shared/DateRangePicker";
import type { DateSelection } from "@/components/shared/DateRangePicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Thresholds {
  roas_min: number;
  cpa_max: number;
  sales_min: number;
}

interface AccountMetrics {
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

interface CampaignInsights {
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  reach: number;
  frequency: number;
  add_to_cart: number;
  cost_per_add_to_cart: number;
  initiate_checkout: number;
  cost_per_initiate_checkout: number;
  landing_page_view: number;
  cost_per_landing_page_view: number;
  outbound_clicks: number;
  outbound_clicks_ctr: number;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  insights: CampaignInsights | null;
}

interface Ad {
  id: string;
  name: string;
  status: string;
  thumbnail_url: string | null;
  insights: CampaignInsights | null;
}

interface ClientDetail {
  id: string;
  name: string;
  meta_account_id: string;
  thresholds: Thresholds | null;
  accountMetrics: AccountMetrics | null;
  campaigns: Campaign[];
  ads: Ad[];
}

// ─── Constants ────────────────────────────────────────────────────────────────


// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function fCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}

type StatusLevel = "excelente" | "apagar" | "seguimiento";

function calcStatus(
  insights: CampaignInsights,
  thresholds: Thresholds | null
): StatusLevel {
  if (!thresholds) return "seguimiento";
  const { roas_min, cpa_max, sales_min } = thresholds;
  const cpa = insights.purchases > 0 ? insights.spend / insights.purchases : 0;
  const roasOk = insights.roas >= roas_min;
  const cpaOk = cpa_max === 0 || cpa <= cpa_max;
  const purchasesOk = insights.purchases >= sales_min;
  if (roasOk && cpaOk && purchasesOk) return "excelente";
  if (!roasOk && !cpaOk) return "apagar";
  return "seguimiento";
}

function StatusBadge({
  insights,
  thresholds,
}: {
  insights: CampaignInsights | null;
  thresholds: Thresholds | null;
}) {
  if (!insights) return <Badge variant="outline">Sin datos</Badge>;
  const status = calcStatus(insights, thresholds);
  if (status === "excelente")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15">
        Gran rendimiento
      </Badge>
    );
  if (status === "apagar") return <Badge variant="destructive">Apagar</Badge>;
  return <Badge variant="secondary">Seguimiento</Badge>;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonMetricCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
      <div className="h-3.5 w-28 bg-muted rounded mb-3" />
      <div className="h-7 w-20 bg-muted rounded" />
    </div>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <TableRow>
      {[...Array(cols)].map((_, i) => (
        <TableCell key={i}>
          <div className="h-4 bg-muted rounded animate-pulse w-24" />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  PAUSED: "Pausada",
  DELETED: "Eliminada",
  ARCHIVED: "Archivada",
};

function translateStatus(status: string) {
  return STATUS_LABELS[status] ?? status;
}

// ─── Campaigns table: sort & resize ──────────────────────────────────────────

type CampaignSortKey =
  | "spend" | "purchases" | "cpa" | "roas" | "revenue"
  | "ticketPromedio" | "tasaConversion" | "ctr"
  | "add_to_cart" | "cost_per_add_to_cart"
  | "initiate_checkout" | "cost_per_initiate_checkout"
  | "landing_page_view" | "cost_per_landing_page_view"
  | "reach" | "cpm" | "frequency";

const CAMPAIGN_COL_WIDTHS: Record<string, number> = {
  estado: 140, name: 250, entrega: 160, spend: 160, purchases: 160,
  cpa: 180, roas: 160, revenue: 200, ticketPromedio: 180, tasaConversion: 200,
  ctr: 160, add_to_cart: 220, cost_per_add_to_cart: 220, initiate_checkout: 180,
  cost_per_initiate_checkout: 200, landing_page_view: 200, cost_per_landing_page_view: 180,
  reach: 160, cpm: 160, frequency: 160,
};

function getCampaignSortValue(campaign: Campaign, key: CampaignSortKey): number {
  const ins = campaign.insights;
  if (!ins) return -Infinity;
  if (key === "ticketPromedio")
    return ins.purchases > 0 ? ins.revenue / ins.purchases : 0;
  if (key === "tasaConversion")
    return ins.landing_page_view > 0 ? ins.purchases / ins.landing_page_view : 0;
  return (ins as unknown as Record<string, number>)[key] ?? 0;
}

// ─── Ads table: sort & resize ─────────────────────────────────────────────────

type AdSortKey =
  | "spend" | "purchases" | "cpa" | "roas" | "revenue"
  | "ticketPromedio" | "tasaConversion" | "ctr"
  | "add_to_cart" | "cost_per_add_to_cart"
  | "initiate_checkout" | "cost_per_initiate_checkout"
  | "landing_page_view" | "cost_per_landing_page_view"
  | "reach" | "cpm" | "frequency";

const AD_COL_WIDTHS: Record<string, number> = {
  adEstado: 140, adName: 250, adEntrega: 160, spend: 160, purchases: 160,
  cpa: 180, roas: 160, revenue: 200, ticketPromedio: 180, tasaConversion: 200,
  ctr: 160, add_to_cart: 220, cost_per_add_to_cart: 220, initiate_checkout: 180,
  cost_per_initiate_checkout: 200, landing_page_view: 200, cost_per_landing_page_view: 180,
  reach: 160, cpm: 160, frequency: 160,
};

function getAdSortValue(ad: Ad, key: AdSortKey): number {
  const ins = ad.insights;
  if (!ins) return -Infinity;
  if (key === "ticketPromedio") return ins.purchases > 0 ? ins.revenue / ins.purchases : 0;
  if (key === "tasaConversion") return ins.landing_page_view > 0 ? ins.purchases / ins.landing_page_view : 0;
  return (ins as unknown as Record<string, number>)[key] ?? 0;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dateSelection, setDateSelection] = useState<DateSelection>({ type: "preset", preset: "last_7d" });
  const [data, setData] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Campaigns sort + resize
  const [sortKey, setSortKey] = useState<CampaignSortKey | null>("purchases");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { colWidths, handleResizeStart, totalWidth } = useResizableCols(CAMPAIGN_COL_WIDTHS);

  // Ads sort + resize
  const [adSortKey, setAdSortKey] = useState<AdSortKey | null>("purchases");
  const [adSortDir, setAdSortDir] = useState<SortDir>("desc");
  const { colWidths: adColWidths, handleResizeStart: adHandleResizeStart, totalWidth: adTotalWidth } = useResizableCols(AD_COL_WIDTHS);

  function handleSort(key: CampaignSortKey) {
    if (sortKey === key) {
      if (sortDir === "desc") setSortDir("asc");
      else { setSortKey(null); setSortDir("desc"); }
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function handleAdSort(key: AdSortKey) {
    if (adSortKey === key) {
      if (adSortDir === "desc") setAdSortDir("asc");
      else { setAdSortKey(null); setAdSortDir("desc"); }
    } else {
      setAdSortKey(key);
      setAdSortDir("desc");
    }
  }

  const sortedCampaigns = useMemo(() => {
    const campaigns = data?.campaigns ?? [];
    if (!sortKey) return campaigns;
    return [...campaigns].sort((a, b) => {
      const va = getCampaignSortValue(a, sortKey);
      const vb = getCampaignSortValue(b, sortKey);
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [data?.campaigns, sortKey, sortDir]);

  const sortedAds = useMemo(() => {
    const ads = data?.ads ?? [];
    if (!adSortKey) return ads;
    return [...ads].sort((a, b) => {
      const va = getAdSortValue(a, adSortKey);
      const vb = getAdSortValue(b, adSortKey);
      return adSortDir === "desc" ? vb - va : va - vb;
    });
  }, [data?.ads, adSortKey, adSortDir]);

  const fetchData = useCallback(
    async (sel: DateSelection) => {
      setLoading(true);
      setError(null);
      try {
        const url =
          sel.type === "preset"
            ? `/api/meta/${id}?datePreset=${sel.preset}`
            : `/api/meta/${id}?since=${sel.since}&until=${sel.until}`;
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Error al cargar los datos.");
        }
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido.");
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    fetchData(dateSelection);
  }, [dateSelection, fetchData]);

  const m = data?.accountMetrics;
  const avgTicket = m && m.purchases > 0 ? m.revenue / m.purchases : 0;

  return (
    <div className="px-8 py-8 max-w-7xl">
      {/* 1. Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <Link href="/dashboard" className="mt-0.5 inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            {loading || !data ? (
              <div className="h-7 w-48 bg-muted rounded animate-pulse" />
            ) : (
              <h1 className="text-2xl font-bold text-foreground">{data.name}</h1>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {data?.meta_account_id
                ? `Cuenta Publicitaria: ${data.meta_account_id.replace(/^act_/, "")}`
                : "Cargando..."}
            </p>
          </div>
        </div>

        {/* Selector de período */}
        <DateRangePicker value={dateSelection} onChange={setDateSelection} />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {/* 2. Métricas principales */}
      <div className="grid grid-cols-6 gap-3 mb-4">
        {loading ? (
          [...Array(6)].map((_, i) => <SkeletonMetricCard key={i} />)
        ) : m ? (
          <>
            <MetricCard label="Inversión" value={fCurrency(m.spend)} />
            <MetricCard label="ROAS" value={`${fNum(m.roas)}x`} />
            <MetricCard label="CPA" value={m.cpa > 0 ? fCurrency(m.cpa) : "—"} />
            <MetricCard label="Compras" value={String(Math.round(m.purchases))} />
            <MetricCard label="Valor de conversión" value={fCurrency(m.revenue)} />
            <MetricCard label="Ticket promedio" value={avgTicket > 0 ? fCurrency(avgTicket) : "—"} />
          </>
        ) : (
          <div className="col-span-6 text-center text-muted-foreground py-8 text-sm">
            Sin datos de métricas para este período.
          </div>
        )}
      </div>

      {/* 3. Métricas secundarias */}
      {(loading || m) && (
        <div className="grid grid-cols-4 gap-3 mb-8">
          {loading ? (
            [...Array(4)].map((_, i) => <SkeletonMetricCard key={i} />)
          ) : m ? (
            <>
              <MetricCard label="CTR" value={`${fNum(m.ctr, 2)}%`} />
              <MetricCard label="CPM" value={fCurrency(m.cpm)} />
              <MetricCard label="Alcance" value={fCompact(m.reach)} />
              <MetricCard label="Frecuencia" value={fNum(m.frequency, 2)} />
            </>
          ) : null}
        </div>
      )}

      {/* 4. Campañas activas */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">
          Campañas activas
        </h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table className="table-fixed" style={{ width: totalWidth }}>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TH colKey="estado" activeSortKey={sortKey} sortDir={sortDir} sticky width={colWidths.estado} onResizeStart={(e) => handleResizeStart(e, "estado")}>Estado</TH>
                <TH colKey="name" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.name} onResizeStart={(e) => handleResizeStart(e, "name")}>Campaña</TH>
                <TH colKey="entrega" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.entrega} onResizeStart={(e) => handleResizeStart(e, "entrega")}>Entrega</TH>
                <TH colKey="spend" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.spend} onSort={() => handleSort("spend")} onResizeStart={(e) => handleResizeStart(e, "spend")}>Importe gastado</TH>
                <TH colKey="purchases" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.purchases} onSort={() => handleSort("purchases")} onResizeStart={(e) => handleResizeStart(e, "purchases")}>Compras</TH>
                <TH colKey="cpa" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.cpa} onSort={() => handleSort("cpa")} onResizeStart={(e) => handleResizeStart(e, "cpa")}>Costo por compra</TH>
                <TH colKey="roas" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.roas} onSort={() => handleSort("roas")} onResizeStart={(e) => handleResizeStart(e, "roas")}>ROAS</TH>
                <TH colKey="revenue" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.revenue} onSort={() => handleSort("revenue")} onResizeStart={(e) => handleResizeStart(e, "revenue")}>Valor de conversión</TH>
                <TH colKey="ticketPromedio" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.ticketPromedio} onSort={() => handleSort("ticketPromedio")} onResizeStart={(e) => handleResizeStart(e, "ticketPromedio")}>Ticket promedio</TH>
                <TH colKey="tasaConversion" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.tasaConversion} onSort={() => handleSort("tasaConversion")} onResizeStart={(e) => handleResizeStart(e, "tasaConversion")}>Tasa de conversión</TH>
                <TH colKey="ctr" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.ctr} onSort={() => handleSort("ctr")} onResizeStart={(e) => handleResizeStart(e, "ctr")}>CTR</TH>
                <TH colKey="add_to_cart" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.add_to_cart} onSort={() => handleSort("add_to_cart")} onResizeStart={(e) => handleResizeStart(e, "add_to_cart")}>Art. agr. al carrito</TH>
                <TH colKey="cost_per_add_to_cart" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.cost_per_add_to_cart} onSort={() => handleSort("cost_per_add_to_cart")} onResizeStart={(e) => handleResizeStart(e, "cost_per_add_to_cart")}>Costo p/art. agregado</TH>
                <TH colKey="initiate_checkout" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.initiate_checkout} onSort={() => handleSort("initiate_checkout")} onResizeStart={(e) => handleResizeStart(e, "initiate_checkout")}>Pagos iniciados</TH>
                <TH colKey="cost_per_initiate_checkout" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.cost_per_initiate_checkout} onSort={() => handleSort("cost_per_initiate_checkout")} onResizeStart={(e) => handleResizeStart(e, "cost_per_initiate_checkout")}>Costo p/pago iniciado</TH>
                <TH colKey="landing_page_view" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.landing_page_view} onSort={() => handleSort("landing_page_view")} onResizeStart={(e) => handleResizeStart(e, "landing_page_view")}>Visitas a pág. destino</TH>
                <TH colKey="cost_per_landing_page_view" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.cost_per_landing_page_view} onSort={() => handleSort("cost_per_landing_page_view")} onResizeStart={(e) => handleResizeStart(e, "cost_per_landing_page_view")}>Costo por visita</TH>
                <TH colKey="reach" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.reach} onSort={() => handleSort("reach")} onResizeStart={(e) => handleResizeStart(e, "reach")}>Alcance</TH>
                <TH colKey="cpm" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.cpm} onSort={() => handleSort("cpm")} onResizeStart={(e) => handleResizeStart(e, "cpm")}>CPM</TH>
                <TH colKey="frequency" activeSortKey={sortKey} sortDir={sortDir} sortable width={colWidths.frequency} onSort={() => handleSort("frequency")} onResizeStart={(e) => handleResizeStart(e, "frequency")}>Frecuencia</TH>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <>
                  <SkeletonRow cols={20} />
                  <SkeletonRow cols={20} />
                </>
              ) : !sortedCampaigns.length ? (
                <TableRow>
                  <TableCell colSpan={20} className="text-center text-muted-foreground py-10 text-sm">
                    No hay campañas activas.
                  </TableCell>
                </TableRow>
              ) : (
                sortedCampaigns.map((campaign) => {
                  const ins = campaign.insights;
                  const ticketPromedio = ins && ins.purchases > 0 ? ins.revenue / ins.purchases : 0;
                  const tasaConversion = ins && ins.landing_page_view > 0 ? ins.purchases / ins.landing_page_view : 0;
                  return (
                    <TableRow key={campaign.id} className="border-border">
                      <TableCell className="sticky left-0 z-10 bg-card">
                        <StatusBadge insights={ins} thresholds={data!.thresholds} />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <span className="block truncate">{campaign.name}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${campaign.status === "ACTIVE" ? "text-emerald-400" : "text-muted-foreground"}`}>
                          {translateStatus(campaign.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins ? fCurrency(ins.spend) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins ? Math.round(ins.purchases) || "—" : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins && ins.cpa > 0 ? fCurrency(ins.cpa) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins ? `${fNum(ins.roas)}x` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins ? fCurrency(ins.revenue) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ticketPromedio > 0 ? fCurrency(ticketPromedio) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {tasaConversion > 0 ? `${fNum(tasaConversion * 100, 1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins ? `${fNum(ins.ctr, 2)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins ? Math.round(ins.add_to_cart) || "—" : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins && ins.cost_per_add_to_cart > 0 ? fCurrency(ins.cost_per_add_to_cart) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins ? Math.round(ins.initiate_checkout) || "—" : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins && ins.cost_per_initiate_checkout > 0 ? fCurrency(ins.cost_per_initiate_checkout) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins ? Math.round(ins.landing_page_view) || "—" : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins && ins.cost_per_landing_page_view > 0 ? fCurrency(ins.cost_per_landing_page_view) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins ? fCompact(ins.reach) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins ? fCurrency(ins.cpm) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular-nums">
                        {ins ? fNum(ins.frequency, 2) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 5. Anuncios activos */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Anuncios activos
        </h2>
        <div className="rounded-xl border border-border bg-card overflow-x-auto [&_td]:overflow-hidden [&_td]:text-ellipsis">
          <Table className="table-fixed" style={{ width: adTotalWidth }}>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TH colKey="adEstado" activeSortKey={adSortKey} sortDir={adSortDir} sticky width={adColWidths.adEstado} onResizeStart={(e) => adHandleResizeStart(e, "adEstado")}>Estado</TH>
                <TH colKey="adName" activeSortKey={adSortKey} sortDir={adSortDir} width={adColWidths.adName} onResizeStart={(e) => adHandleResizeStart(e, "adName")}>Anuncio</TH>
                <TH colKey="adEntrega" activeSortKey={adSortKey} sortDir={adSortDir} width={adColWidths.adEntrega} onResizeStart={(e) => adHandleResizeStart(e, "adEntrega")}>Entrega</TH>
                <TH colKey="spend" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.spend} onSort={() => handleAdSort("spend")} onResizeStart={(e) => adHandleResizeStart(e, "spend")}>Inversión</TH>
                <TH colKey="purchases" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.purchases} onSort={() => handleAdSort("purchases")} onResizeStart={(e) => adHandleResizeStart(e, "purchases")}>Compras</TH>
                <TH colKey="cpa" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.cpa} onSort={() => handleAdSort("cpa")} onResizeStart={(e) => adHandleResizeStart(e, "cpa")}>Costo por compra</TH>
                <TH colKey="roas" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.roas} onSort={() => handleAdSort("roas")} onResizeStart={(e) => adHandleResizeStart(e, "roas")}>ROAS</TH>
                <TH colKey="revenue" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.revenue} onSort={() => handleAdSort("revenue")} onResizeStart={(e) => adHandleResizeStart(e, "revenue")}>Valor de conversión</TH>
                <TH colKey="ticketPromedio" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.ticketPromedio} onSort={() => handleAdSort("ticketPromedio")} onResizeStart={(e) => adHandleResizeStart(e, "ticketPromedio")}>Ticket promedio</TH>
                <TH colKey="tasaConversion" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.tasaConversion} onSort={() => handleAdSort("tasaConversion")} onResizeStart={(e) => adHandleResizeStart(e, "tasaConversion")}>Tasa de conversión</TH>
                <TH colKey="ctr" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.ctr} onSort={() => handleAdSort("ctr")} onResizeStart={(e) => adHandleResizeStart(e, "ctr")}>CTR</TH>
                <TH colKey="add_to_cart" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.add_to_cart} onSort={() => handleAdSort("add_to_cart")} onResizeStart={(e) => adHandleResizeStart(e, "add_to_cart")}>Art. agr. al carrito</TH>
                <TH colKey="cost_per_add_to_cart" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.cost_per_add_to_cart} onSort={() => handleAdSort("cost_per_add_to_cart")} onResizeStart={(e) => adHandleResizeStart(e, "cost_per_add_to_cart")}>Costo p/art. agregado</TH>
                <TH colKey="initiate_checkout" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.initiate_checkout} onSort={() => handleAdSort("initiate_checkout")} onResizeStart={(e) => adHandleResizeStart(e, "initiate_checkout")}>Pagos iniciados</TH>
                <TH colKey="cost_per_initiate_checkout" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.cost_per_initiate_checkout} onSort={() => handleAdSort("cost_per_initiate_checkout")} onResizeStart={(e) => adHandleResizeStart(e, "cost_per_initiate_checkout")}>Costo p/pago iniciado</TH>
                <TH colKey="landing_page_view" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.landing_page_view} onSort={() => handleAdSort("landing_page_view")} onResizeStart={(e) => adHandleResizeStart(e, "landing_page_view")}>Visitas a pág. destino</TH>
                <TH colKey="cost_per_landing_page_view" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.cost_per_landing_page_view} onSort={() => handleAdSort("cost_per_landing_page_view")} onResizeStart={(e) => adHandleResizeStart(e, "cost_per_landing_page_view")}>Costo por visita</TH>
                <TH colKey="reach" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.reach} onSort={() => handleAdSort("reach")} onResizeStart={(e) => adHandleResizeStart(e, "reach")}>Alcance</TH>
                <TH colKey="cpm" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.cpm} onSort={() => handleAdSort("cpm")} onResizeStart={(e) => adHandleResizeStart(e, "cpm")}>CPM</TH>
                <TH colKey="frequency" activeSortKey={adSortKey} sortDir={adSortDir} sortable width={adColWidths.frequency} onSort={() => handleAdSort("frequency")} onResizeStart={(e) => adHandleResizeStart(e, "frequency")}>Frecuencia</TH>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <>
                  <SkeletonRow cols={20} />
                  <SkeletonRow cols={20} />
                </>
              ) : !sortedAds.length ? (
                <TableRow>
                  <TableCell colSpan={20} className="text-center text-muted-foreground py-10 text-sm">
                    No hay anuncios activos.
                  </TableCell>
                </TableRow>
              ) : (
                sortedAds.map((ad) => {
                  const ins = ad.insights;
                  const ticketPromedio = ins && ins.purchases > 0 ? ins.revenue / ins.purchases : 0;
                  const tasaConversion = ins && ins.landing_page_view > 0 ? ins.purchases / ins.landing_page_view : 0;
                  return (
                    <TableRow key={ad.id} className="border-border">
                      <TableCell className="sticky left-0 z-10 bg-card">
                        <StatusBadge insights={ins} thresholds={data!.thresholds} />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          {ad.thumbnail_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ad.thumbnail_url}
                              alt=""
                              className="h-9 w-9 rounded object-cover shrink-0 bg-muted"
                            />
                          )}
                          <span className="truncate">{ad.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${ad.status === "ACTIVE" ? "text-emerald-400" : "text-muted-foreground"}`}>
                          {translateStatus(ad.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins ? fCurrency(ins.spend) : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins ? Math.round(ins.purchases) || "—" : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins && ins.cpa > 0 ? fCurrency(ins.cpa) : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins ? `${fNum(ins.roas)}x` : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins ? fCurrency(ins.revenue) : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ticketPromedio > 0 ? fCurrency(ticketPromedio) : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {tasaConversion > 0 ? `${fNum(tasaConversion * 100, 1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins ? `${fNum(ins.ctr, 2)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins ? Math.round(ins.add_to_cart) || "—" : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins && ins.cost_per_add_to_cart > 0 ? fCurrency(ins.cost_per_add_to_cart) : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins ? Math.round(ins.initiate_checkout) || "—" : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins && ins.cost_per_initiate_checkout > 0 ? fCurrency(ins.cost_per_initiate_checkout) : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins ? Math.round(ins.landing_page_view) || "—" : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins && ins.cost_per_landing_page_view > 0 ? fCurrency(ins.cost_per_landing_page_view) : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins ? fCompact(ins.reach) : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins ? fCurrency(ins.cpm) : "—"}
                      </TableCell>
                      <TableCell className="text-foreground tabular-nums">
                        {ins ? fNum(ins.frequency, 2) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
