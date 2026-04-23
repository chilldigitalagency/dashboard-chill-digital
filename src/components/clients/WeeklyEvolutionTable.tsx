"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekMetrics {
  spend: number;
  purchases: number;
  revenue: number;
  roas: number;
  cpa: number;
  ctr: number;
  landing_page_view: number;
}

interface Week {
  since: string;
  until: string;
  label: string;
  isCurrent: boolean;
  metrics: WeekMetrics | null;
  loading: boolean;
  error: boolean;
}

interface WeeklyEvolutionTableProps {
  clientId: string;
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

function getWeeks(): Omit<Week, "metrics" | "loading" | "error">[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  const daysToMonday = dow === 0 ? 6 : dow - 1;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - daysToMonday);

  const result: Omit<Week, "metrics" | "loading" | "error">[] = [];
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

const ROWS: RowDef[] = [
  {
    label: "Inversión",
    raw: (m) => m.spend,
    format: (m) => fCurrency(m.spend),
    positiveIsGood: true,
    alwaysNeutral: true,
  },
  {
    label: "Compras",
    raw: (m) => m.purchases,
    format: (m) => fNum(m.purchases),
    positiveIsGood: true,
  },
  {
    label: "CPA",
    raw: (m) => m.cpa,
    format: (m) => m.cpa > 0 ? fCurrency(m.cpa) : "—",
    positiveIsGood: false,
  },
  {
    label: "ROAS",
    raw: (m) => m.roas,
    format: (m) => `${fNum(m.roas, 2)}x`,
    positiveIsGood: true,
  },
  {
    label: "Facturación",
    raw: (m) => m.revenue,
    format: (m) => fCurrency(m.revenue),
    positiveIsGood: true,
  },
  {
    label: "Ticket promedio",
    raw: (m) => m.purchases > 0 ? m.revenue / m.purchases : 0,
    format: (m) => m.purchases > 0 ? fCurrency(m.revenue / m.purchases) : "—",
    positiveIsGood: true,
  },
  {
    label: "Tasa de conversión",
    raw: (m) => m.landing_page_view > 0 ? (m.purchases / m.landing_page_view) * 100 : 0,
    format: (m) => m.landing_page_view > 0 ? `${fNum((m.purchases / m.landing_page_view) * 100, 2)}%` : "—",
    positiveIsGood: true,
  },
  {
    label: "CTR",
    raw: (m) => m.ctr,
    format: (m) => `${fNum(m.ctr, 2)}%`,
    positiveIsGood: true,
  },
];

// ─── Cell ─────────────────────────────────────────────────────────────────────

function MetricCell({
  week, prevWeek, row,
}: {
  week: Week;
  prevWeek: Week | null;
  row: RowDef;
}) {
  if (week.loading) {
    return (
      <td className="px-4 py-3">
        <div className="h-4 w-20 rounded bg-muted animate-pulse mb-1" />
        <div className="h-3 w-12 rounded bg-muted animate-pulse opacity-60" />
      </td>
    );
  }
  if (week.error || !week.metrics) {
    return <td className="px-4 py-3 text-sm text-muted-foreground/50">—</td>;
  }

  const showVar = !!prevWeek && !!prevWeek.metrics && !prevWeek.loading;

  return (
    <td className="px-4 py-3">
      <span className="text-sm text-foreground tabular-nums">{row.format(week.metrics)}</span>
      {showVar && (
        <VarBadge
          current={row.raw(week.metrics)}
          previous={row.raw(prevWeek!.metrics!)}
          positiveIsGood={row.positiveIsGood}
          alwaysNeutral={row.alwaysNeutral}
        />
      )}
    </td>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WeeklyEvolutionTable({ clientId }: WeeklyEvolutionTableProps) {
  const [weeks, setWeeks] = useState<Week[]>(() =>
    getWeeks().map((w) => ({ ...w, metrics: null, loading: true, error: false }))
  );

  useEffect(() => {
    const weekDefs = getWeeks();
    setWeeks(weekDefs.map((w) => ({ ...w, metrics: null, loading: true, error: false })));

    weekDefs.forEach((w, idx) => {
      fetch(`/api/meta/${clientId}?since=${w.since}&until=${w.until}&type=overview`)
        .then((r) => r.json())
        .then((json) => {
          const m = json?.accountMetrics ?? null;
          setWeeks((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], metrics: m, loading: false, error: !m };
            return next;
          });
        })
        .catch(() => {
          setWeeks((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], loading: false, error: true };
            return next;
          });
        });
    });
  }, [clientId]);

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
