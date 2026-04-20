"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
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
import { DailySpendChart } from "@/components/charts/DailySpendChart";
import { DailySalesChart } from "@/components/charts/DailySalesChart";
import { DailyRevenueChart } from "@/components/charts/DailyRevenueChart";
import { DailyVisitsChart } from "@/components/charts/DailyVisitsChart";
import { AdPreviewModal } from "@/components/ads/AdPreviewModal";
import { ConversionFunnelChart } from "@/components/charts/ConversionFunnelChart";
import type { DailyInsightsPoint } from "@/lib/meta-ads/client";

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
  messages: number;
  cost_per_message: number;
  ig_profile_visits: number;
  landing_page_view: number;
  add_to_cart: number;
  initiate_checkout: number;
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
  impressions: number;
  frequency: number;
  clicks: number;
  add_to_cart: number;
  cost_per_add_to_cart: number;
  initiate_checkout: number;
  cost_per_initiate_checkout: number;
  landing_page_view: number;
  cost_per_landing_page_view: number;
  outbound_clicks: number;
  outbound_clicks_ctr: number;
  messages: number;
  cost_per_message: number;
  ig_profile_visits: number;
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

interface OverviewData {
  id: string;
  name: string;
  meta_account_id: string;
  client_type: "ecommerce" | "servicios";
  thresholds: Thresholds | null;
  accountMetrics: AccountMetrics | null;
  comparisonMetrics: AccountMetrics | null;
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
  if (!thresholds || thresholds.cpa_max === 0) return "seguimiento";
  const { roas_min, cpa_max, sales_min } = thresholds;
  const { spend, purchases, roas } = insights;
  const cpa = purchases > 0 ? spend / purchases : 0;

  // Gate de gasto: 1.2x para CPA ≥ $30.000, 1.5x para CPA ≥ $20.000, 2x para el resto
  const spendGate = cpa_max >= 30000 ? cpa_max * 1.2 : cpa_max >= 20000 ? cpa_max * 1.5 : cpa_max * 2;

  const debeApagar =
    (spend >= spendGate && cpa >= 1.5 * cpa_max && roas <= 0.8 * roas_min) ||
    (spend >= spendGate && purchases === 0);

  const debeEscalar =
    purchases > 0 &&
    cpa <= 0.9 * cpa_max &&
    roas >= roas_min * 1.1 &&
    purchases >= sales_min;

  if (debeApagar) return "apagar";
  if (debeEscalar) return "excelente";
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

// change > 0 means increased, invertedGood means lower = better (e.g. CPA)
function ChangeIndicator({ current, previous, invertedGood = false }: { current: number; previous: number; invertedGood?: boolean }) {
  if (!previous || previous === 0) return <span className="text-xs text-muted-foreground/50">—</span>;
  const pct = ((current - previous) / previous) * 100;
  const isGood = invertedGood ? pct <= 0 : pct >= 0;
  const sign = pct >= 0 ? "+" : "";
  const color = isGood ? "text-emerald-400" : "text-red-400";
  const arrow = pct >= 0 ? "↑" : "↓";
  return (
    <span className={`text-xs font-medium ${color}`}>
      {arrow} {sign}{Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function MetricCard({
  label,
  value,
  sub,
  current,
  previous,
  invertedGood,
}: {
  label: string;
  value: string;
  sub?: string;
  current?: number;
  previous?: number;
  invertedGood?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <div className="mt-2 flex items-center gap-1.5">
        {current !== undefined && previous !== undefined ? (
          <>
            <ChangeIndicator current={current} previous={previous} invertedGood={invertedGood} />
            <span className="text-xs text-muted-foreground/50">vs período ant.</span>
          </>
        ) : sub ? (
          <p className="text-xs text-muted-foreground">{sub}</p>
        ) : null}
      </div>
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
  camToggle: 56, estado: 140, name: 250, entrega: 160, spend: 160, purchases: 160,
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

// ─── Services: result helper ──────────────────────────────────────────────────

interface ServiceResult {
  value: number;
  label: string;
  costPerResult: number;
}

function getServiceResult(ins: CampaignInsights): ServiceResult {
  if (ins.ig_profile_visits > 0) {
    return { value: ins.ig_profile_visits, label: "Visitas al perfil IG", costPerResult: ins.spend / ins.ig_profile_visits };
  }
  if (ins.messages > 0) {
    return { value: ins.messages, label: "Mensajes", costPerResult: ins.cost_per_message > 0 ? ins.cost_per_message : ins.spend / ins.messages };
  }
  if (ins.outbound_clicks > 0) {
    return { value: ins.outbound_clicks, label: "Clics en el enlace", costPerResult: ins.spend / ins.outbound_clicks };
  }
  return { value: 0, label: "—", costPerResult: 0 };
}

// ─── Services tables: sort & resize ──────────────────────────────────────────

type ServicesSortKey = "spend" | "resultados" | "cost_per_result" | "ctr" | "outbound_clicks" | "reach" | "frequency";

const SERVICES_COL_WIDTHS: Record<string, number> = {
  name: 280, entrega: 140, spend: 160, resultados: 180, cost_per_result: 200, ctr: 140, outbound_clicks: 180, reach: 160, frequency: 140,
};

function getServicesSortValue(item: Campaign | Ad, key: ServicesSortKey): number {
  const ins = item.insights;
  if (!ins) return -Infinity;
  if (key === "resultados") return getServiceResult(ins).value;
  if (key === "cost_per_result") return getServiceResult(ins).costPerResult;
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
  adToggle: 56, adEstado: 140, adName: 250, adEntrega: 160, spend: 160, purchases: 160,
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
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [dateSelection, setDateSelection] = useState<DateSelection>({ type: "preset", preset: "last_7d" });
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyData, setDailyData] = useState<DailyInsightsPoint[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);

  // Campaigns sort + resize
  const [sortKey, setSortKey] = useState<CampaignSortKey | null>("purchases");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { colWidths, handleResizeStart, totalWidth } = useResizableCols(CAMPAIGN_COL_WIDTHS);

  // Ads sort + resize
  const [adSortKey, setAdSortKey] = useState<AdSortKey | null>("purchases");
  const [adSortDir, setAdSortDir] = useState<SortDir>("desc");
  const { colWidths: adColWidths, handleResizeStart: adHandleResizeStart, totalWidth: adTotalWidth } = useResizableCols(AD_COL_WIDTHS);

  // Campaign status toggle (optimistic)
  const [campaignStatuses, setCampaignStatuses] = useState<Record<string, "ACTIVE" | "PAUSED">>({});
  const [togglingCampaigns, setTogglingCampaigns] = useState<Set<string>>(new Set());

  // Ad status toggle (optimistic)
  const [adStatuses, setAdStatuses] = useState<Record<string, "ACTIVE" | "PAUSED">>({});
  const [togglingAds, setTogglingAds] = useState<Set<string>>(new Set());

  // Ad preview modal
  const [previewAd, setPreviewAd] = useState<{ id: string; name: string } | null>(null);

  async function handleExportPdf() {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      const { exportToPdf } = await import("@/lib/utils/exportPdf");
      const clientName = data?.name ?? "reporte";
      await exportToPdf(reportRef.current, `${clientName}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  async function handleToggleCampaign(campaignId: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setCampaignStatuses((prev) => ({ ...prev, [campaignId]: newStatus as "ACTIVE" | "PAUSED" }));
    setTogglingCampaigns((prev) => new Set(prev).add(campaignId));
    try {
      const res = await fetch(`/api/meta/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, clientId: id }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setCampaignStatuses((prev) => ({ ...prev, [campaignId]: currentStatus as "ACTIVE" | "PAUSED" }));
    } finally {
      setTogglingCampaigns((prev) => { const s = new Set(prev); s.delete(campaignId); return s; });
    }
  }

  async function handleToggleAd(adId: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setAdStatuses((prev) => ({ ...prev, [adId]: newStatus as "ACTIVE" | "PAUSED" }));
    setTogglingAds((prev) => new Set(prev).add(adId));
    try {
      const res = await fetch(`/api/meta/ads/${adId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, clientId: id }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      setAdStatuses((prev) => ({ ...prev, [adId]: currentStatus as "ACTIVE" | "PAUSED" }));
    } finally {
      setTogglingAds((prev) => { const s = new Set(prev); s.delete(adId); return s; });
    }
  }

  // Services sort + resize (campaigns)
  const [svcSortKey, setSvcSortKey] = useState<ServicesSortKey | null>("resultados");
  const [svcSortDir, setSvcSortDir] = useState<SortDir>("desc");
  const { colWidths: svcColWidths, handleResizeStart: svcHandleResizeStart, totalWidth: svcTotalWidth } = useResizableCols(SERVICES_COL_WIDTHS);

  // Services sort + resize (ads)
  const [svcAdSortKey, setSvcAdSortKey] = useState<ServicesSortKey | null>("resultados");
  const [svcAdSortDir, setSvcAdSortDir] = useState<SortDir>("desc");
  const { colWidths: svcAdColWidths, handleResizeStart: svcAdHandleResizeStart, totalWidth: svcAdTotalWidth } = useResizableCols(SERVICES_COL_WIDTHS);

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

  function handleSvcSort(key: ServicesSortKey) {
    if (svcSortKey === key) {
      if (svcSortDir === "desc") setSvcSortDir("asc");
      else { setSvcSortKey(null); setSvcSortDir("desc"); }
    } else {
      setSvcSortKey(key);
      setSvcSortDir("desc");
    }
  }

  function handleSvcAdSort(key: ServicesSortKey) {
    if (svcAdSortKey === key) {
      if (svcAdSortDir === "desc") setSvcAdSortDir("asc");
      else { setSvcAdSortKey(null); setSvcAdSortDir("desc"); }
    } else {
      setSvcAdSortKey(key);
      setSvcAdSortDir("desc");
    }
  }

  const sortedCampaigns = useMemo(() => {
    if (!sortKey) return campaigns;
    return [...campaigns].sort((a, b) => {
      const va = getCampaignSortValue(a, sortKey);
      const vb = getCampaignSortValue(b, sortKey);
      return sortDir === "desc" ? vb - va : va - vb;
    });
  }, [campaigns, sortKey, sortDir]);

  const sortedAds = useMemo(() => {
    if (!adSortKey) return ads;
    return [...ads].sort((a, b) => {
      const va = getAdSortValue(a, adSortKey);
      const vb = getAdSortValue(b, adSortKey);
      return adSortDir === "desc" ? vb - va : va - vb;
    });
  }, [ads, adSortKey, adSortDir]);

  const sortedSvcCampaigns = useMemo(() => {
    if (!svcSortKey) return campaigns;
    return [...campaigns].sort((a, b) => {
      const va = getServicesSortValue(a, svcSortKey);
      const vb = getServicesSortValue(b, svcSortKey);
      return svcSortDir === "desc" ? vb - va : va - vb;
    });
  }, [campaigns, svcSortKey, svcSortDir]);

  const sortedSvcAds = useMemo(() => {
    if (!svcAdSortKey) return ads;
    return [...ads].sort((a, b) => {
      const va = getServicesSortValue(a, svcAdSortKey);
      const vb = getServicesSortValue(b, svcAdSortKey);
      return svcAdSortDir === "desc" ? vb - va : va - vb;
    });
  }, [ads, svcAdSortKey, svcAdSortDir]);

  const m = data?.accountMetrics;
  const cmp = data?.comparisonMetrics;

  const funnelData = useMemo(() => ({
    current: {
      landing_page_views: m?.landing_page_view ?? 0,
      add_to_cart:        m?.add_to_cart ?? 0,
      initiate_checkout:  m?.initiate_checkout ?? 0,
      purchases:          m?.purchases ?? 0,
    },
    previous: {
      landing_page_views: cmp?.landing_page_view ?? 0,
      add_to_cart:        cmp?.add_to_cart ?? 0,
      initiate_checkout:  cmp?.initiate_checkout ?? 0,
      purchases:          cmp?.purchases ?? 0,
    },
  }), [m, cmp]);

  const fetchData = useCallback(
    async (sel: DateSelection) => {
      setLoading(true);
      setBreakdownLoading(true);
      setDailyLoading(true);
      setError(null);
      const qs =
        sel.type === "preset"
          ? `datePreset=${sel.preset}`
          : `since=${sel.since}&until=${sel.until}`;

      // Fire all three fetches simultaneously; overview resolves first
      const overviewPromise = fetch(`/api/meta/${id}?${qs}&type=overview`)
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? "Error al cargar los datos.");
          }
          return res.json();
        })
        .then((d: OverviewData) => {
          setData(d);
          setLoading(false);
        });

      const breakdownPromise = fetch(`/api/meta/${id}?${qs}&type=breakdown`)
        .then((res) => res.json())
        .then((d: { campaigns: Campaign[]; ads: Ad[] }) => {
          setCampaigns(d.campaigns ?? []);
          setAds(d.ads ?? []);
          setBreakdownLoading(false);
        });

      const dailyPromise = fetch(`/api/meta/${id}/daily?${qs}`)
        .then((res) => res.json())
        .then((d: unknown) => {
          setDailyData(Array.isArray(d) ? d : []);
          setDailyLoading(false);
        });

      try {
        await overviewPromise;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido.");
        setLoading(false);
        setBreakdownLoading(false);
        setDailyLoading(false);
      }

      // Let breakdown and daily finish silently
      breakdownPromise.catch(() => setBreakdownLoading(false));
      dailyPromise.catch(() => setDailyLoading(false));
    },
    [id]
  );

  useEffect(() => {
    fetchData(dateSelection);
  }, [dateSelection, fetchData]);

  const avgTicket = m && m.purchases > 0 ? m.revenue / m.purchases : 0;
  const avgTicketPrev = cmp && cmp.purchases > 0 ? cmp.revenue / cmp.purchases : 0;

  return (
    <div ref={reportRef} className="px-8 py-8 max-w-7xl">
      {/* 1. Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <Link href="/dashboard" data-html2canvas-ignore className="print-hide mt-0.5 inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
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

        {/* Controles superiores */}
        <div className="flex items-center gap-2 print-hide" data-html2canvas-ignore>
          <button
            onClick={handleExportPdf}
            disabled={exporting || loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent border border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />}
            PDF
          </button>
          <DateRangePicker value={dateSelection} onChange={setDateSelection} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {/* 2. Métricas principales */}
      {data?.client_type === "servicios" ? (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {loading ? (
              [...Array(4)].map((_, i) => <SkeletonMetricCard key={i} />)
            ) : m ? (
              <>
                <MetricCard label="Inversión" value={fCurrency(m.spend)} />
                <MetricCard label="Alcance" value={fCompact(m.reach)} />
                <MetricCard label="Impresiones" value={fCompact(m.impressions)} />
                <MetricCard label="Frecuencia" value={fNum(m.frequency, 2)} />
              </>
            ) : (
              <div className="col-span-4 text-center text-muted-foreground py-8 text-sm">
                Sin datos de métricas para este período.
              </div>
            )}
          </div>
          {(loading || m) && (
            <div className="grid grid-cols-4 gap-3 mb-8">
              {loading ? (
                [...Array(4)].map((_, i) => <SkeletonMetricCard key={i} />)
              ) : m ? (() => {
                const accountResult = getServiceResult(m as unknown as CampaignInsights);
                return (
                  <>
                    <MetricCard label={accountResult.label !== "—" ? accountResult.label : "Resultados"} value={accountResult.value > 0 ? String(Math.round(accountResult.value)) : "—"} />
                    <MetricCard label="Costo por resultado" value={accountResult.costPerResult > 0 ? fCurrency(accountResult.costPerResult) : "—"} />
                    <MetricCard label="CTR" value={`${fNum(m.ctr, 2)}%`} />
                    <MetricCard label="Clics en el enlace" value={m.clicks > 0 ? fCompact(m.clicks) : "—"} />
                  </>
                );
              })() : null}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-6 gap-3 mb-8">
            {loading ? (
              [...Array(6)].map((_, i) => <SkeletonMetricCard key={i} />)
            ) : m ? (
              <>
                <MetricCard label="Inversión" value={fCurrency(m.spend)} current={m.spend} previous={cmp?.spend ?? 0} />
                <MetricCard label="Compras" value={String(Math.round(m.purchases))} current={m.purchases} previous={cmp?.purchases ?? 0} />
                <MetricCard label="Costo por compra" value={m.cpa > 0 ? fCurrency(m.cpa) : "—"} current={m.cpa} previous={cmp?.cpa ?? 0} invertedGood />
                <MetricCard label="ROAS" value={`${fNum(m.roas)}x`} current={m.roas} previous={cmp?.roas ?? 0} />
                <MetricCard label="Facturación" value={fCurrency(m.revenue)} current={m.revenue} previous={cmp?.revenue ?? 0} />
                <MetricCard label="Ticket promedio" value={avgTicket > 0 ? fCurrency(avgTicket) : "—"} current={avgTicket} previous={avgTicketPrev} />
              </>
            ) : (
              <div className="col-span-6 text-center text-muted-foreground py-8 text-sm">
                Sin datos de métricas para este período.
              </div>
            )}
          </div>
        </>
      )}

      {/* 4. Campañas activas */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">
          Campañas activas
        </h2>

        {/* ── Servicios ── */}
        {data?.client_type === "servicios" ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table className="table-fixed" style={{ width: svcTotalWidth }}>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TH colKey="name" activeSortKey={svcSortKey} sortDir={svcSortDir} width={svcColWidths.name} onResizeStart={(e) => svcHandleResizeStart(e, "name")}>Campaña</TH>
                  <TH colKey="entrega" activeSortKey={svcSortKey} sortDir={svcSortDir} width={svcColWidths.entrega} onResizeStart={(e) => svcHandleResizeStart(e, "entrega")}>Entrega</TH>
                  <TH colKey="spend" activeSortKey={svcSortKey} sortDir={svcSortDir} sortable width={svcColWidths.spend} onSort={() => handleSvcSort("spend")} onResizeStart={(e) => svcHandleResizeStart(e, "spend")}>Inversión</TH>
                  <TH colKey="resultados" activeSortKey={svcSortKey} sortDir={svcSortDir} sortable width={svcColWidths.resultados} onSort={() => handleSvcSort("resultados")} onResizeStart={(e) => svcHandleResizeStart(e, "resultados")}>Resultados</TH>
                  <TH colKey="cost_per_result" activeSortKey={svcSortKey} sortDir={svcSortDir} sortable width={svcColWidths.cost_per_result} onSort={() => handleSvcSort("cost_per_result")} onResizeStart={(e) => svcHandleResizeStart(e, "cost_per_result")}>Costo por resultado</TH>
                  <TH colKey="ctr" activeSortKey={svcSortKey} sortDir={svcSortDir} sortable width={svcColWidths.ctr} onSort={() => handleSvcSort("ctr")} onResizeStart={(e) => svcHandleResizeStart(e, "ctr")}>CTR</TH>
                  <TH colKey="outbound_clicks" activeSortKey={svcSortKey} sortDir={svcSortDir} sortable width={svcColWidths.outbound_clicks} onSort={() => handleSvcSort("outbound_clicks")} onResizeStart={(e) => svcHandleResizeStart(e, "outbound_clicks")}>Clics en el enlace</TH>
                  <TH colKey="reach" activeSortKey={svcSortKey} sortDir={svcSortDir} sortable width={svcColWidths.reach} onSort={() => handleSvcSort("reach")} onResizeStart={(e) => svcHandleResizeStart(e, "reach")}>Alcance</TH>
                  <TH colKey="frequency" activeSortKey={svcSortKey} sortDir={svcSortDir} sortable width={svcColWidths.frequency} onSort={() => handleSvcSort("frequency")} onResizeStart={(e) => svcHandleResizeStart(e, "frequency")}>Frecuencia</TH>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdownLoading ? (
                  <><SkeletonRow cols={9} /><SkeletonRow cols={9} /></>
                ) : !sortedSvcCampaigns.length ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10 text-sm">No hay campañas activas.</TableCell>
                  </TableRow>
                ) : (
                  sortedSvcCampaigns.map((campaign) => {
                    const ins = campaign.insights;
                    const result = ins ? getServiceResult(ins) : null;
                    return (
                      <TableRow key={campaign.id} className="border-border">
                        <TableCell className="font-medium text-foreground"><span className="block truncate">{campaign.name}</span></TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium ${campaign.status === "ACTIVE" ? "text-emerald-400" : "text-muted-foreground"}`}>{translateStatus(campaign.status)}</span>
                        </TableCell>
                        <TableCell className="text-right text-foreground tabular-nums">{ins ? fCurrency(ins.spend) : "—"}</TableCell>
                        <TableCell className="text-foreground tabular-nums">
                          {result && result.value > 0 ? (
                            <div>
                              <div className="text-right font-medium">{Math.round(result.value)}</div>
                              <div className="text-xs text-muted-foreground text-right">{result.label}</div>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-foreground tabular-nums">{result && result.costPerResult > 0 ? fCurrency(result.costPerResult) : "—"}</TableCell>
                        <TableCell className="text-right text-foreground tabular-nums">{ins ? `${fNum(ins.ctr, 2)}%` : "—"}</TableCell>
                        <TableCell className="text-right text-foreground tabular-nums">{ins && ins.outbound_clicks > 0 ? Math.round(ins.outbound_clicks) : "—"}</TableCell>
                        <TableCell className="text-right text-foreground tabular-nums">{ins ? fCompact(ins.reach) : "—"}</TableCell>
                        <TableCell className="text-right text-foreground tabular-nums">{ins ? fNum(ins.frequency, 2) : "—"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        ) : (

        /* ── Ecommerce ── */
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table className="table-fixed" style={{ width: totalWidth }}>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TH colKey="camToggle" activeSortKey={sortKey} sortDir={sortDir} width={colWidths.camToggle} onResizeStart={(e) => handleResizeStart(e, "camToggle")}><span className="print-hide">{""}</span></TH>
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
              {breakdownLoading ? (
                <>
                  <SkeletonRow cols={21} />
                  <SkeletonRow cols={21} />
                </>
              ) : !sortedCampaigns.length ? (
                <TableRow>
                  <TableCell colSpan={21} className="text-center text-muted-foreground py-10 text-sm">
                    No hay campañas activas.
                  </TableCell>
                </TableRow>
              ) : (
                sortedCampaigns.map((campaign) => {
                  const ins = campaign.insights;
                  const ticketPromedio = ins && ins.purchases > 0 ? ins.revenue / ins.purchases : 0;
                  const tasaConversion = ins && ins.landing_page_view > 0 ? ins.purchases / ins.landing_page_view : 0;
                  const effectiveCampaignStatus = campaignStatuses[campaign.id] ?? campaign.status;
                  const isCampaignToggling = togglingCampaigns.has(campaign.id);
                  const isCampaignActive = effectiveCampaignStatus === "ACTIVE";
                  return (
                    <TableRow key={campaign.id} className="border-border">
                      <TableCell>
                        <button
                          onClick={() => handleToggleCampaign(campaign.id, effectiveCampaignStatus)}
                          disabled={isCampaignToggling}
                          className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: isCampaignActive ? "#604ad9" : "#374151" }}
                          title={isCampaignActive ? "Pausar campaña" : "Activar campaña"}
                        >
                          <span
                            className="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
                            style={{ transform: isCampaignActive ? "translateX(18px)" : "translateX(2px)" }}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="sticky left-0 z-10 bg-card">
                        <StatusBadge insights={ins} thresholds={data?.thresholds ?? null} />
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
        )}
      </div>

      {/* 5. Anuncios activos */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Anuncios activos
        </h2>

        {/* ── Servicios ── */}
        {data?.client_type === "servicios" ? (
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <Table className="table-fixed" style={{ width: svcAdTotalWidth }}>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TH colKey="adName" activeSortKey={svcAdSortKey} sortDir={svcAdSortDir} width={svcAdColWidths.name} onResizeStart={(e) => svcAdHandleResizeStart(e, "adName")}>Anuncio</TH>
                  <TH colKey="adEntrega" activeSortKey={svcAdSortKey} sortDir={svcAdSortDir} width={svcAdColWidths.entrega} onResizeStart={(e) => svcAdHandleResizeStart(e, "adEntrega")}>Entrega</TH>
                  <TH colKey="spend" activeSortKey={svcAdSortKey} sortDir={svcAdSortDir} sortable width={svcAdColWidths.spend} onSort={() => handleSvcAdSort("spend")} onResizeStart={(e) => svcAdHandleResizeStart(e, "spend")}>Inversión</TH>
                  <TH colKey="resultados" activeSortKey={svcAdSortKey} sortDir={svcAdSortDir} sortable width={svcAdColWidths.resultados} onSort={() => handleSvcAdSort("resultados")} onResizeStart={(e) => svcAdHandleResizeStart(e, "resultados")}>Resultados</TH>
                  <TH colKey="cost_per_result" activeSortKey={svcAdSortKey} sortDir={svcAdSortDir} sortable width={svcAdColWidths.cost_per_result} onSort={() => handleSvcAdSort("cost_per_result")} onResizeStart={(e) => svcAdHandleResizeStart(e, "cost_per_result")}>Costo por resultado</TH>
                  <TH colKey="ctr" activeSortKey={svcAdSortKey} sortDir={svcAdSortDir} sortable width={svcAdColWidths.ctr} onSort={() => handleSvcAdSort("ctr")} onResizeStart={(e) => svcAdHandleResizeStart(e, "ctr")}>CTR</TH>
                  <TH colKey="outbound_clicks" activeSortKey={svcAdSortKey} sortDir={svcAdSortDir} sortable width={svcAdColWidths.outbound_clicks} onSort={() => handleSvcAdSort("outbound_clicks")} onResizeStart={(e) => svcAdHandleResizeStart(e, "outbound_clicks")}>Clics en el enlace</TH>
                  <TH colKey="reach" activeSortKey={svcAdSortKey} sortDir={svcAdSortDir} sortable width={svcAdColWidths.reach} onSort={() => handleSvcAdSort("reach")} onResizeStart={(e) => svcAdHandleResizeStart(e, "reach")}>Alcance</TH>
                  <TH colKey="frequency" activeSortKey={svcAdSortKey} sortDir={svcAdSortDir} sortable width={svcAdColWidths.frequency} onSort={() => handleSvcAdSort("frequency")} onResizeStart={(e) => svcAdHandleResizeStart(e, "frequency")}>Frecuencia</TH>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdownLoading ? (
                  <><SkeletonRow cols={9} /><SkeletonRow cols={9} /></>
                ) : !sortedSvcAds.length ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10 text-sm">No hay anuncios activos.</TableCell>
                  </TableRow>
                ) : (
                  sortedSvcAds.map((ad) => {
                    const ins = ad.insights;
                    const result = ins ? getServiceResult(ins) : null;
                    return (
                      <TableRow key={ad.id} className="border-border">
                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center gap-3">
                            {ad.thumbnail_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={ad.thumbnail_url} alt="" className="h-9 w-9 rounded object-cover shrink-0 bg-muted" />
                            )}
                            <span className="truncate">{ad.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-medium ${ad.status === "ACTIVE" ? "text-emerald-400" : "text-muted-foreground"}`}>{translateStatus(ad.status)}</span>
                        </TableCell>
                        <TableCell className="text-right text-foreground tabular-nums">{ins ? fCurrency(ins.spend) : "—"}</TableCell>
                        <TableCell className="text-foreground tabular-nums">
                          {result && result.value > 0 ? (
                            <div>
                              <div className="text-right font-medium">{Math.round(result.value)}</div>
                              <div className="text-xs text-muted-foreground text-right">{result.label}</div>
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-foreground tabular-nums">{result && result.costPerResult > 0 ? fCurrency(result.costPerResult) : "—"}</TableCell>
                        <TableCell className="text-right text-foreground tabular-nums">{ins ? `${fNum(ins.ctr, 2)}%` : "—"}</TableCell>
                        <TableCell className="text-right text-foreground tabular-nums">{ins && ins.outbound_clicks > 0 ? Math.round(ins.outbound_clicks) : "—"}</TableCell>
                        <TableCell className="text-right text-foreground tabular-nums">{ins ? fCompact(ins.reach) : "—"}</TableCell>
                        <TableCell className="text-right text-foreground tabular-nums">{ins ? fNum(ins.frequency, 2) : "—"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        ) : (

        /* ── Ecommerce ── */
        <div className="rounded-xl border border-border bg-card overflow-x-auto [&_td]:overflow-hidden [&_td]:text-ellipsis">
          <Table className="table-fixed" style={{ width: adTotalWidth }}>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TH colKey="adToggle" activeSortKey={adSortKey} sortDir={adSortDir} width={adColWidths.adToggle} onResizeStart={(e) => adHandleResizeStart(e, "adToggle")}><span className="print-hide">{""}</span></TH>
                <TH colKey="adEstado" activeSortKey={adSortKey} sortDir={adSortDir} width={adColWidths.adEstado} onResizeStart={(e) => adHandleResizeStart(e, "adEstado")}>Estado</TH>
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
              {breakdownLoading ? (
                <>
                  <SkeletonRow cols={21} />
                  <SkeletonRow cols={21} />
                </>
              ) : !sortedAds.length ? (
                <TableRow>
                  <TableCell colSpan={21} className="text-center text-muted-foreground py-10 text-sm">
                    No hay anuncios activos.
                  </TableCell>
                </TableRow>
              ) : (
                sortedAds.map((ad) => {
                  const ins = ad.insights;
                  const ticketPromedio = ins && ins.purchases > 0 ? ins.revenue / ins.purchases : 0;
                  const tasaConversion = ins && ins.landing_page_view > 0 ? ins.purchases / ins.landing_page_view : 0;
                  const effectiveStatus = adStatuses[ad.id] ?? ad.status;
                  const isToggling = togglingAds.has(ad.id);
                  const isActive = effectiveStatus === "ACTIVE";
                  return (
                    <TableRow key={ad.id} className="border-border">
                      <TableCell>
                        <button
                          onClick={() => handleToggleAd(ad.id, effectiveStatus)}
                          disabled={isToggling}
                          className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: isActive ? "#604ad9" : "#374151" }}
                          title={isActive ? "Pausar anuncio" : "Activar anuncio"}
                        >
                          <span
                            className="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
                            style={{ transform: isActive ? "translateX(18px)" : "translateX(2px)" }}
                          />
                        </button>
                      </TableCell>
                      <TableCell>
                        <StatusBadge insights={ins} thresholds={data?.thresholds ?? null} />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <button
                          className="flex items-center gap-3 w-full text-left rounded-lg px-2 py-1 -mx-2 transition-colors hover:bg-[#604ad9]/20"
                          onClick={() => setPreviewAd({ id: ad.id, name: ad.name })}
                          title="Ver vista previa"
                        >
                          {ad.thumbnail_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ad.thumbnail_url}
                              alt=""
                              className="h-9 w-9 rounded object-cover shrink-0 bg-muted"
                            />
                          )}
                          <span className="truncate">{ad.name}</span>
                        </button>
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
        )}
      </div>

      {/* 6. Gráficos evolutivos diarios — solo ecommerce */}
      {data?.client_type !== "servicios" && (
        <div className="mt-8 mb-8 flex flex-col gap-6">
          <DailySpendChart data={dailyData} loading={dailyLoading} />
          <DailySalesChart data={dailyData} loading={dailyLoading} />
          <DailyRevenueChart data={dailyData} loading={dailyLoading} />
          <DailyVisitsChart data={dailyData} loading={dailyLoading} />
          <ConversionFunnelChart data={funnelData.current} previousData={funnelData.previous} loading={loading} />
        </div>
      )}

      {/* Ad preview modal */}
      {previewAd && (
        <AdPreviewModal
          adId={previewAd.id}
          adName={previewAd.name}
          clientId={id}
          onClose={() => setPreviewAd(null)}
        />
      )}
    </div>
  );
}
