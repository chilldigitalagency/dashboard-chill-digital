"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Channel = "meta" | "google" | "all";

interface WeekMetrics {
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

interface Week {
  since: string;
  until: string;
  label: string;
  isCurrent: boolean;
  metaMetrics: WeekMetrics | null;
  googleMetrics: WeekMetrics | null;
  loading: boolean;
  error: boolean;
}

interface WeeklyEvolutionTableProps {
  clientId: string;
  clientType?: "ecommerce" | "servicios";
  channel?: Channel;
  hasGoogle?: boolean;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

function fShort(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function getWeeks(): Pick<Week, "since" | "until" | "label" | "isCurrent">[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - daysToMonday);

  const result: Pick<Week, "since" | "until" | "label" | "isCurrent">[] = [];
  for (let i = 3; i >= 0; i--) {
    const monday = new Date(currentMonday);
    monday.setDate(currentMonday.getDate() - i * 7);
    const isCurrent = i === 0;
    const sunday = isCurrent
      ? new Date(today)
      : new Date(monday.getTime() + 6 * 86400000);
    result.push({
      since: fmt(monday),
      until: fmt(sunday),
      label: `${fShort(monday)} – ${fShort(sunday)}`,
      isCurrent,
    });
  }
  return result;
}

// ─── Metrics helpers ──────────────────────────────────────────────────────────

const ZERO_METRICS: WeekMetrics = {
  spend: 0, purchases: 0, revenue: 0, roas: 0, cpa: 0,
  ctr: 0, cpm: 0, clicks: 0, landing_page_view: 0,
  ig_profile_visits: 0, messages: 0, cost_per_message: 0,
};

function googleToWeekMetrics(g: {
  spend: number; conversions: number; conversion_value: number;
  roas: number; cpa: number; clicks: number;
}): WeekMetrics {
  return {
    ...ZERO_METRICS,
    spend: g.spend,
    purchases: g.conversions,
    revenue: g.conversion_value,
    roas: g.roas,
    cpa: g.cpa,
    clicks: g.clicks,
  };
}

function combineMetrics(meta: WeekMetrics, google: WeekMetrics): WeekMetrics {
  const spend = meta.spend + google.spend;
  const purchases = meta.purchases + google.purchases;
  const revenue = meta.revenue + google.revenue;
  return {
    ...meta,
    spend,
    purchases,
    revenue,
    roas: spend > 0 ? revenue / spend : 0,
    cpa: purchases > 0 ? spend / purchases : 0,
    clicks: (meta.clicks ?? 0) + (google.clicks ?? 0),
  };
}

function getDisplayMetrics(week: Week, channel: Channel): WeekMetrics | null {
  if (channel === "google") return week.googleMetrics;
  if (channel === "all") {
    if (!week.metaMetrics && !week.googleMetrics) return null;
    return combineMetrics(week.metaMetrics ?? ZERO_METRICS, week.googleMetrics ?? ZERO_METRICS);
  }
  return week.metaMetrics;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fCurrency(v: number) {
  return "$" + new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function fNum(v: number, dec = 0) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
}

// ─── Variation badge ─────────────────────────────────────────────────────────

function VarBadge({ current, previous, positiveIsGood, alwaysNeutral = false }: {
  current: number;
  previous: number;
  positiveIsGood: boolean;
  alwaysNeutral?: boolean;
}) {
  if (!previous) return null;
  const pct = ((current - previous) / previous) * 100;
  const isNeutral = alwaysNeutral || Math.abs(pct) < 0.05;
  const isGood = isNeutral ? null : (pct > 0) === positiveIsGood;

  const color = isNeutral ? "text-muted-foreground" : isGood ? "text-emerald-400" : "text-red-400";
  const dot   = isNeutral ? "bg-muted-foreground"   : isGood ? "bg-emerald-400"   : "bg-red-400";
  const sign  = pct > 0 ? "+" : "";

  return (
    <div className={`flex items-center gap-1 mt-0.5 ${color}`}>
      <span className="text-xs tabular-nums">{sign}{fNum(pct, 2)}%</span>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dot}`} />
    </div>
  );
}

// ─── Row definition ──────────────────────────────────────────────────────────

type RowDef = {
  label: string;
  raw: (m: WeekMetrics) => number;
  format: (m: WeekMetrics) => string;
  positiveIsGood: boolean;
  alwaysNeutral?: boolean;
};

const ECOMMERCE_ROWS: RowDef[] = [
  { label: "Inversión",          raw: (m) => m.spend,       format: (m) => fCurrency(m.spend),                                                                    positiveIsGood: true,  alwaysNeutral: true },
  { label: "Compras",            raw: (m) => m.purchases,   format: (m) => fNum(m.purchases),                                                                     positiveIsGood: true  },
  { label: "CPA",                raw: (m) => m.cpa,         format: (m) => m.cpa > 0 ? fCurrency(m.cpa) : "—",                                                    positiveIsGood: false },
  { label: "ROAS",               raw: (m) => m.roas,        format: (m) => `${fNum(m.roas, 2)}x`,                                                                  positiveIsGood: true  },
  { label: "Facturación",        raw: (m) => m.revenue,     format: (m) => fCurrency(m.revenue),                                                                   positiveIsGood: true  },
  { label: "Ticket promedio",    raw: (m) => m.purchases > 0 ? m.revenue / m.purchases : 0,       format: (m) => m.purchases > 0 ? fCurrency(m.revenue / m.purchases) : "—",                           positiveIsGood: true  },
  { label: "Clics",              raw: (m) => m.clicks ?? 0, format: (m) => fNum(m.clicks ?? 0),                                                                   positiveIsGood: true  },
  { label: "Tasa de conversión", raw: (m) => m.landing_page_view > 0 ? (m.purchases / m.landing_page_view) * 100 : 0, format: (m) => m.landing_page_view > 0 ? `${fNum((m.purchases / m.landing_page_view) * 100, 2)}%` : "—", positiveIsGood: true },
  { label: "CTR",                raw: (m) => m.ctr,         format: (m) => `${fNum(m.ctr, 2)}%`,                                                                   positiveIsGood: true  },
];

const SERVICIOS_ROWS: RowDef[] = [
  { label: "Inversión",           raw: (m) => m.spend,                                                              format: (m) => fCurrency(m.spend),                                                              positiveIsGood: true,  alwaysNeutral: true },
  { label: "Visitas al perfil IG",raw: (m) => m.ig_profile_visits,                                                  format: (m) => fNum(m.ig_profile_visits),                                                       positiveIsGood: true  },
  { label: "Costo por visita",    raw: (m) => m.ig_profile_visits > 0 ? m.spend / m.ig_profile_visits : 0,          format: (m) => m.ig_profile_visits > 0 ? fCurrency(m.spend / m.ig_profile_visits) : "—",        positiveIsGood: false },
  { label: "Mensajes",            raw: (m) => m.messages,                                                           format: (m) => fNum(m.messages),                                                                positiveIsGood: true  },
  { label: "Costo por mensaje",   raw: (m) => m.cost_per_message > 0 ? m.cost_per_message : (m.messages > 0 ? m.spend / m.messages : 0), format: (m) => m.cost_per_message > 0 ? fCurrency(m.cost_per_message) : (m.messages > 0 ? fCurrency(m.spend / m.messages) : "—"), positiveIsGood: false },
  { label: "CTR",                 raw: (m) => m.ctr,                                                                format: (m) => `${fNum(m.ctr, 2)}%`,                                                            positiveIsGood: true  },
  { label: "CPM",                 raw: (m) => m.cpm,                                                                format: (m) => fCurrency(m.cpm),                                                                positiveIsGood: false },
];

const COMBINED_ROWS: RowDef[] = [
  { label: "Inversión",       raw: (m) => m.spend,                                                     format: (m) => fCurrency(m.spend),                                                    positiveIsGood: true,  alwaysNeutral: true },
  { label: "Compras",         raw: (m) => m.purchases,                                                 format: (m) => fNum(m.purchases),                                                     positiveIsGood: true  },
  { label: "CPA",             raw: (m) => m.cpa,                                                       format: (m) => m.cpa > 0 ? fCurrency(m.cpa) : "—",                                   positiveIsGood: false },
  { label: "ROAS",            raw: (m) => m.roas,                                                      format: (m) => `${fNum(m.roas, 2)}x`,                                                 positiveIsGood: true  },
  { label: "Facturación",     raw: (m) => m.revenue,                                                   format: (m) => fCurrency(m.revenue),                                                  positiveIsGood: true  },
  { label: "Ticket promedio", raw: (m) => m.purchases > 0 ? m.revenue / m.purchases : 0,              format: (m) => m.purchases > 0 ? fCurrency(m.revenue / m.purchases) : "—",            positiveIsGood: true  },
  { label: "Clics",           raw: (m) => m.clicks ?? 0,                                               format: (m) => fNum(m.clicks ?? 0),                                                   positiveIsGood: true  },
];

// ─── Cell ─────────────────────────────────────────────────────────────────────

function MetricCell({
  week, prevWeek, row, channel,
}: {
  week: Week;
  prevWeek: Week | null;
  row: RowDef;
  channel: Channel;
}) {
  const metrics = getDisplayMetrics(week, channel);
  const prevMetrics = prevWeek ? getDisplayMetrics(prevWeek, channel) : null;

  if (week.loading) {
    return (
      <td className="px-4 py-3">
        <div className="h-4 w-20 rounded bg-muted animate-pulse mb-1" />
        <div className="h-3 w-12 rounded bg-muted animate-pulse opacity-60" />
      </td>
    );
  }
  if (week.error || !metrics) {
    return <td className="px-4 py-3 text-sm text-muted-foreground/50">—</td>;
  }

  const showVar = !!prevWeek && !!prevMetrics && !prevWeek.loading;

  return (
    <td className="px-4 py-3">
      <span className="text-sm text-foreground tabular-nums">{row.format(metrics)}</span>
      {showVar && (
        <VarBadge
          current={row.raw(metrics)}
          previous={row.raw(prevMetrics!)}
          positiveIsGood={row.positiveIsGood}
          alwaysNeutral={row.alwaysNeutral}
        />
      )}
    </td>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WeeklyEvolutionTable({
  clientId,
  clientType = "ecommerce",
  channel = "meta",
  hasGoogle = false,
}: WeeklyEvolutionTableProps) {
  const [weeks, setWeeks] = useState<Week[]>(() =>
    getWeeks().map((w) => ({ ...w, metaMetrics: null, googleMetrics: null, loading: true, error: false }))
  );

  useEffect(() => {
    const weekDefs = getWeeks();
    setWeeks(weekDefs.map((w) => ({ ...w, metaMetrics: null, googleMetrics: null, loading: true, error: false })));

    weekDefs.forEach((w, idx) => {
      const metaPromise = fetch(`/api/meta/${clientId}?since=${w.since}&until=${w.until}&type=overview`)
        .then((r) => r.json())
        .then((json) => json?.accountMetrics ?? null)
        .catch(() => null);

      const googlePromise = (hasGoogle && channel !== "meta")
        ? fetch(`/api/google/${clientId}?since=${w.since}&until=${w.until}`)
            .then((r) => r.json())
            .then((json) => json?.current ? googleToWeekMetrics(json.current) : null)
            .catch(() => null)
        : Promise.resolve(null);

      Promise.all([metaPromise, googlePromise]).then(([metaMetrics, googleMetrics]) => {
        setWeeks((prev) => {
          const next = [...prev];
          const hasData = !!(metaMetrics || googleMetrics);
          next[idx] = { ...next[idx], metaMetrics, googleMetrics, loading: false, error: !hasData };
          return next;
        });
      });
    });
  }, [clientId, channel, hasGoogle]);

  let ROWS: RowDef[];
  if (channel === "google") {
    ROWS = COMBINED_ROWS;
  } else if (channel === "all" && hasGoogle) {
    ROWS = COMBINED_ROWS;
  } else {
    ROWS = clientType === "servicios" ? SERVICIOS_ROWS : ECOMMERCE_ROWS;
  }

  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold text-foreground mb-3">Evolutivo semanal</h2>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-semibold text-foreground whitespace-nowrap">Métrica</th>
              {weeks.map((w) => (
                <th key={w.since} className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                  {w.isCurrent ? (
                    <span className="text-foreground">
                      Semana actual
                      <span className="block text-xs font-normal text-muted-foreground mt-0.5">{w.label}</span>
                    </span>
                  ) : (
                    <span className="text-foreground">{w.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr
                key={row.label}
                className={`border-b border-border last:border-0 transition-colors hover:bg-accent/40 ${i % 2 === 0 ? "" : "bg-white/[0.015]"}`}
              >
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{row.label}</td>
                {weeks.map((w, idx) => (
                  <MetricCell
                    key={w.since}
                    week={w}
                    prevWeek={idx > 0 ? weeks[idx - 1] : null}
                    row={row}
                    channel={channel}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
