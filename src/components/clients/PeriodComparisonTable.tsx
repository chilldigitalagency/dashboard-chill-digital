"use client";

import type { DateSelection } from "@/components/shared/DateRangePicker";

type Channel = "meta" | "google" | "all";

interface Metrics {
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpm: number;
  clicks: number;
  landing_page_view: number;
  ig_profile_visits: number;
  messages: number;
  cost_per_message: number;
}

interface GoogleMetrics {
  spend: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  cpa: number;
  clicks: number;
  impressions: number;
}

interface PeriodComparisonTableProps {
  current: Metrics | null;
  previous: Metrics | null;
  dateSelection: DateSelection;
  loading?: boolean;
  clientType?: "ecommerce" | "servicios";
  channel?: Channel;
  googleCurrent?: GoogleMetrics | null;
  googlePrevious?: GoogleMetrics | null;
}

// ─── Period label helpers ─────────────────────────────────────────────────────

function getPeriodLabels(sel: DateSelection): [string, string] {
  if (sel.type === "custom") return ["Período actual", "Período anterior"];
  switch (sel.preset) {
    case "today":      return ["Hoy",             "Ayer"];
    case "yesterday":  return ["Ayer",             "Día anterior"];
    case "last_7d":    return ["Últimos 7 días",   "Semana anterior"];
    case "last_14d":   return ["Últimos 14 días",  "Período anterior"];
    case "last_30d":   return ["Últimos 30 días",  "Período anterior"];
    case "this_month": return ["Este mes",         "Mes pasado"];
    case "last_month": return ["Mes pasado",       "Mes anterior"];
    default:           return ["Período actual",   "Período anterior"];
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fCurrency(v: number) {
  return "$" + new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function fNum(v: number, decimals = 0) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

// ─── Change indicator ─────────────────────────────────────────────────────────

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

type Direction = "positive" | "negative" | "neutral";

function ChangeCell({ current, previous, positiveIsGood = true, alwaysNeutral = false }: {
  current: number;
  previous: number;
  positiveIsGood?: boolean;
  alwaysNeutral?: boolean;
}) {
  const pct = pctChange(current, previous);
  if (pct === null) return <td className="px-5 py-3 text-sm text-muted-foreground tabular-nums">—</td>;

  const isPositive = pct > 0;
  const isNeutral  = alwaysNeutral || Math.abs(pct) < 0.05;

  let dir: Direction = "neutral";
  if (!isNeutral) dir = (isPositive === positiveIsGood) ? "positive" : "negative";

  const color = dir === "positive" ? "text-emerald-400" : dir === "negative" ? "text-red-400" : "text-muted-foreground";
  const dot   = dir === "positive" ? "bg-emerald-400"  : dir === "negative" ? "bg-red-400"   : "bg-muted-foreground";

  const sign = pct > 0 ? "+" : "";

  return (
    <td className="px-5 py-3 text-sm tabular-nums">
      <div className="flex items-center gap-2">
        <span className={`font-medium ${color}`}>{sign}{fNum(pct, 2)}%</span>
        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
      </div>
    </td>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[1,2,3,4].map(i => (
        <td key={i} className="px-5 py-3">
          <div className="h-4 rounded bg-muted animate-pulse" style={{ width: i === 1 ? "60%" : "50%" }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Row = {
  label: string;
  cur: string;
  prev: string;
  curRaw: number;
  prevRaw: number;
  positiveIsGood: boolean;
  alwaysNeutral?: boolean;
};

export function PeriodComparisonTable({
  current, previous, dateSelection, loading,
  clientType = "ecommerce",
  channel = "meta",
  googleCurrent, googlePrevious,
}: PeriodComparisonTableProps) {
  const [labelCurrent, labelPrevious] = getPeriodLabels(dateSelection);

  // ── Meta ecommerce rows ───────────────────────────────────────────────────
  const ticketCurrent  = current  && current.purchases  > 0 ? current.revenue  / current.purchases  : 0;
  const ticketPrevious = previous && previous.purchases > 0 ? previous.revenue / previous.purchases : 0;
  const convCurrent    = current  && current.landing_page_view  > 0 ? (current.purchases  / current.landing_page_view)  * 100 : 0;
  const convPrevious   = previous && previous.landing_page_view > 0 ? (previous.purchases / previous.landing_page_view) * 100 : 0;
  const costPerVisitCur  = current  && current.ig_profile_visits  > 0 ? current.spend  / current.ig_profile_visits  : 0;
  const costPerVisitPrev = previous && previous.ig_profile_visits > 0 ? previous.spend / previous.ig_profile_visits : 0;

  const ecommerceRows: Row[] = current && previous ? [
    { label: "Inversión",          cur: fCurrency(current.spend),    prev: fCurrency(previous.spend),    curRaw: current.spend,    prevRaw: previous.spend,    positiveIsGood: true, alwaysNeutral: true },
    { label: "Compras",            cur: fNum(current.purchases),     prev: fNum(previous.purchases),     curRaw: current.purchases, prevRaw: previous.purchases, positiveIsGood: true  },
    { label: "CPA",                cur: fCurrency(current.cpa),      prev: fCurrency(previous.cpa),      curRaw: current.cpa,      prevRaw: previous.cpa,      positiveIsGood: false },
    { label: "ROAS",               cur: `${fNum(current.roas, 2)}x`, prev: `${fNum(previous.roas, 2)}x`, curRaw: current.roas,     prevRaw: previous.roas,     positiveIsGood: true  },
    { label: "Facturación",        cur: fCurrency(current.revenue),  prev: fCurrency(previous.revenue),  curRaw: current.revenue,  prevRaw: previous.revenue,  positiveIsGood: true  },
    { label: "Ticket promedio",    cur: fCurrency(ticketCurrent),    prev: fCurrency(ticketPrevious),    curRaw: ticketCurrent,    prevRaw: ticketPrevious,    positiveIsGood: true  },
    { label: "Tasa de conversión", cur: `${fNum(convCurrent, 2)}%`,  prev: `${fNum(convPrevious, 2)}%`,  curRaw: convCurrent,      prevRaw: convPrevious,      positiveIsGood: true  },
    { label: "CTR",                cur: `${fNum(current.ctr, 2)}%`,  prev: `${fNum(previous.ctr, 2)}%`,  curRaw: current.ctr,      prevRaw: previous.ctr,      positiveIsGood: true  },
    { label: "Clics",              cur: fNum(current.clicks ?? 0),   prev: fNum(previous.clicks ?? 0),   curRaw: current.clicks ?? 0, prevRaw: previous.clicks ?? 0, positiveIsGood: true  },
  ] : [];

  const serviciosRows: Row[] = current && previous ? [
    { label: "Inversión",           cur: fCurrency(current.spend),                                                     prev: fCurrency(previous.spend),                                                     curRaw: current.spend,                 prevRaw: previous.spend,                 positiveIsGood: true,  alwaysNeutral: true },
    { label: "Visitas al perfil IG",cur: fNum(current.ig_profile_visits),                                              prev: fNum(previous.ig_profile_visits),                                              curRaw: current.ig_profile_visits,     prevRaw: previous.ig_profile_visits,     positiveIsGood: true  },
    { label: "Costo por visita",    cur: costPerVisitCur  > 0 ? fCurrency(costPerVisitCur)  : "$0,00",                 prev: costPerVisitPrev > 0 ? fCurrency(costPerVisitPrev) : "$0,00",                  curRaw: costPerVisitCur,               prevRaw: costPerVisitPrev,               positiveIsGood: false },
    { label: "Mensajes",            cur: fNum(current.messages),                                                       prev: fNum(previous.messages),                                                       curRaw: current.messages,              prevRaw: previous.messages,              positiveIsGood: true  },
    { label: "Costo por mensaje",   cur: current.cost_per_message  > 0 ? fCurrency(current.cost_per_message)  : "—",  prev: previous.cost_per_message > 0 ? fCurrency(previous.cost_per_message) : "—",   curRaw: current.cost_per_message,      prevRaw: previous.cost_per_message,      positiveIsGood: false },
    { label: "CTR",                 cur: `${fNum(current.ctr, 2)}%`,                                                   prev: `${fNum(previous.ctr, 2)}%`,                                                   curRaw: current.ctr,                   prevRaw: previous.ctr,                   positiveIsGood: true  },
    { label: "CPM",                 cur: fCurrency(current.cpm),                                                       prev: fCurrency(previous.cpm),                                                       curRaw: current.cpm,                   prevRaw: previous.cpm,                   positiveIsGood: false },
  ] : [];

  // ── Google rows ───────────────────────────────────────────────────────────
  const googleRows: Row[] = googleCurrent && googlePrevious ? [
    { label: "Inversión",          cur: fCurrency(googleCurrent.spend),            prev: fCurrency(googlePrevious.spend),            curRaw: googleCurrent.spend,            prevRaw: googlePrevious.spend,            positiveIsGood: true,  alwaysNeutral: true },
    { label: "Conversiones",       cur: fNum(googleCurrent.conversions),           prev: fNum(googlePrevious.conversions),           curRaw: googleCurrent.conversions,      prevRaw: googlePrevious.conversions,      positiveIsGood: true  },
    { label: "CPA",                cur: googleCurrent.cpa > 0 ? fCurrency(googleCurrent.cpa) : "—",  prev: googlePrevious.cpa > 0 ? fCurrency(googlePrevious.cpa) : "—", curRaw: googleCurrent.cpa, prevRaw: googlePrevious.cpa, positiveIsGood: false },
    { label: "ROAS",               cur: `${fNum(googleCurrent.roas, 2)}x`,        prev: `${fNum(googlePrevious.roas, 2)}x`,        curRaw: googleCurrent.roas,             prevRaw: googlePrevious.roas,             positiveIsGood: true  },
    { label: "Valor de conversión",cur: fCurrency(googleCurrent.conversion_value), prev: fCurrency(googlePrevious.conversion_value), curRaw: googleCurrent.conversion_value, prevRaw: googlePrevious.conversion_value, positiveIsGood: true  },
    { label: "Clics",              cur: fNum(googleCurrent.clicks),               prev: fNum(googlePrevious.clicks),               curRaw: googleCurrent.clicks,           prevRaw: googlePrevious.clicks,           positiveIsGood: true  },
  ] : [];

  // ── Combined rows ─────────────────────────────────────────────────────────
  const combinedRows: Row[] = (() => {
    if (!current || !previous || !googleCurrent || !googlePrevious) return [];
    const curSpend = current.spend + googleCurrent.spend;
    const prevSpend = previous.spend + googlePrevious.spend;
    const curConv = current.purchases + googleCurrent.conversions;
    const prevConv = previous.purchases + googlePrevious.conversions;
    const curRev = current.revenue + googleCurrent.conversion_value;
    const prevRev = previous.revenue + googlePrevious.conversion_value;
    const curRoas = curSpend > 0 ? curRev / curSpend : 0;
    const prevRoas = prevSpend > 0 ? prevRev / prevSpend : 0;
    const curCpa = curConv > 0 ? curSpend / curConv : 0;
    const prevCpa = prevConv > 0 ? prevSpend / prevConv : 0;
    const curClics = (current.clicks ?? 0) + googleCurrent.clicks;
    const prevClics = (previous.clicks ?? 0) + googlePrevious.clicks;

    return [
      { label: "Inversión total",    cur: fCurrency(curSpend),        prev: fCurrency(prevSpend),       curRaw: curSpend,   prevRaw: prevSpend,  positiveIsGood: true,  alwaysNeutral: true },
      { label: "Compras",            cur: fNum(curConv),              prev: fNum(prevConv),             curRaw: curConv,    prevRaw: prevConv,   positiveIsGood: true  },
      { label: "CPA",                cur: curCpa > 0 ? fCurrency(curCpa) : "—",  prev: prevCpa > 0 ? fCurrency(prevCpa) : "—", curRaw: curCpa, prevRaw: prevCpa,   positiveIsGood: false },
      { label: "ROAS",               cur: `${fNum(curRoas, 2)}x`,     prev: `${fNum(prevRoas, 2)}x`,   curRaw: curRoas,    prevRaw: prevRoas,   positiveIsGood: true  },
      { label: "Facturación total",  cur: fCurrency(curRev),          prev: fCurrency(prevRev),         curRaw: curRev,     prevRaw: prevRev,    positiveIsGood: true  },
      { label: "Ticket promedio",    cur: curConv > 0 ? fCurrency(curRev / curConv) : "—",  prev: prevConv > 0 ? fCurrency(prevRev / prevConv) : "—", curRaw: curConv > 0 ? curRev / curConv : 0, prevRaw: prevConv > 0 ? prevRev / prevConv : 0, positiveIsGood: true },
      { label: "Clics",              cur: fNum(curClics),             prev: fNum(prevClics),            curRaw: curClics,   prevRaw: prevClics,  positiveIsGood: true  },
    ];
  })();

  // ── Select rows based on channel ──────────────────────────────────────────
  let rows: Row[] = [];
  if (channel === "google") {
    rows = googleRows;
  } else if (channel === "all" && (googleCurrent || googlePrevious)) {
    rows = combinedRows;
  } else {
    rows = clientType === "servicios" ? serviciosRows : ecommerceRows;
  }

  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold text-foreground mb-3">Comparativa de períodos</h2>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-5 py-3 text-left font-semibold text-foreground">Métrica</th>
              <th className="px-5 py-3 text-left font-semibold text-foreground">{labelCurrent}</th>
              <th className="px-5 py-3 text-left font-semibold text-foreground">{labelPrevious}</th>
              <th className="px-5 py-3 text-left font-semibold text-foreground">Variación</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} />)
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">
                  Sin datos para el período seleccionado.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.label} className={`border-b border-border last:border-0 transition-colors hover:bg-accent/40 ${i % 2 === 0 ? "" : "bg-white/[0.015]"}`}>
                  <td className="px-5 py-3 text-muted-foreground">{row.label}</td>
                  <td className="px-5 py-3 text-foreground font-medium tabular-nums">{row.cur}</td>
                  <td className="px-5 py-3 text-muted-foreground tabular-nums">{row.prev}</td>
                  <ChangeCell current={row.curRaw} previous={row.prevRaw} positiveIsGood={row.positiveIsGood} alwaysNeutral={row.alwaysNeutral} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
