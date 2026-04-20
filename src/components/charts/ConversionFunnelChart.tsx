"use client";

const STEPS = [
  { key: "landing_page_views", label: "Visitas a la página de destino" },
  { key: "add_to_cart",        label: "Artículos agregados al carrito" },
  { key: "initiate_checkout",  label: "Pagos iniciados" },
  { key: "purchases",          label: "Compras" },
] as const;

const COLORS = ["#604ad9", "#7b66de", "#9782e3", "#b39ee8"];

interface FunnelData {
  landing_page_views: number;
  add_to_cart: number;
  initiate_checkout: number;
  purchases: number;
}

interface ConversionFunnelChartProps {
  data: FunnelData;
  previousData?: FunnelData;
  loading?: boolean;
}

function fmt(n: number) {
  return n > 0 ? n.toLocaleString("es-AR") : "—";
}

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  if (!previous || previous === 0) return <span className="text-xs text-muted-foreground/50">—</span>;
  const pct = ((current - previous) / previous) * 100;
  const isGood = pct >= 0;
  const sign = pct >= 0 ? "+" : "";
  const color = isGood ? "text-emerald-400" : "text-red-400";
  const arrow = pct >= 0 ? "↑" : "↓";
  return (
    <span className={`text-xs font-medium ${color}`}>
      {arrow} {sign}{Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function ConversionFunnelChart({ data, previousData, loading }: ConversionFunnelChartProps) {
  const values: number[] = [
    data.landing_page_views,
    data.add_to_cart,
    data.initiate_checkout,
    data.purchases,
  ];

  const prevValues: number[] = previousData ? [
    previousData.landing_page_views,
    previousData.add_to_cart,
    previousData.initiate_checkout,
    previousData.purchases,
  ] : [0, 0, 0, 0];

  const max = values[0] || 1;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-foreground mb-6">Embudo de conversión</h3>

      {loading ? (
        <div className="space-y-5">
          {[100, 68, 48, 30].map((w, i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="flex justify-between">
                <div className="h-3 w-48 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
              <div className="h-9 bg-muted rounded-lg" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {STEPS.map((step, i) => {
            const value = values[i];
            const prevValue = prevValues[i];
            const pct = max > 0 ? (value / max) * 100 : 0;
            const convRate =
              i === 0
                ? null
                : values[i - 1] > 0
                ? (value / values[i - 1]) * 100
                : 0;

            return (
              <div key={step.key}>
                {/* Label + metrics row */}
                <div className="flex items-center justify-between mb-1.5 gap-4">
                  <span className="text-xs text-muted-foreground truncate">{step.label}</span>
                  <div className="flex items-center gap-4 shrink-0">
                    {convRate !== null && (
                      <span className="text-xs text-muted-foreground/50 tabular-nums">
                        {convRate.toFixed(1)}% conv.
                      </span>
                    )}
                    {previousData && (
                      <ChangeIndicator current={value} previous={prevValue} />
                    )}
                    <span className="text-sm font-semibold text-foreground tabular-nums w-16 text-right">
                      {fmt(value)}
                    </span>
                  </div>
                </div>

                {/* Bar */}
                <div className="h-9 w-full rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div
                    className="h-full rounded-lg transition-all duration-700 ease-out"
                    style={{
                      width: `${pct}%`,
                      background: value > 0 ? COLORS[i] : "transparent",
                      minWidth: value > 0 ? 4 : 0,
                    }}
                  />
                </div>

                {/* Comparison subtext */}
                {previousData && prevValue > 0 && (
                  <div className="mt-1 pl-0.5">
                    <span className="text-xs text-muted-foreground/50">
                      {fmt(prevValue)} período ant.
                    </span>
                  </div>
                )}

                {/* Arrow connector between steps */}
                {i < STEPS.length - 1 && (
                  <div className="flex justify-start pl-1 mt-1 mb-0.5">
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path d="M6 10L0 0H12L6 10Z" fill="rgba(255,255,255,0.12)" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
