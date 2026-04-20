"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyInsightsPoint } from "@/lib/meta-ads/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fCurrency(value: number) {
  return "$" + new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [, month, day] = dateStr.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipEntry { dataKey?: string; value?: number; payload?: DailyInsightsPoint }
interface CustomTooltipProps { active?: boolean; payload?: TooltipEntry[]; label?: string }

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.payload;
  if (!raw) return null;

  return (
    <div style={{ background: "hsl(222 47% 11%)", border: "1px solid rgba(255,255,255,0.08)" }}
      className="rounded-xl px-4 py-3 shadow-xl text-sm"
    >
      <p className="font-semibold text-white mb-2">{formatDate(label ?? "")}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: "#604ad9" }} />
          <span style={{ color: "#94a3b8" }}>Facturación:</span>
          <span className="font-semibold text-white ml-auto pl-3">{fCurrency(raw.revenue)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex-shrink-0 w-2.5 border-t-2 border-dashed" style={{ borderColor: "#a78bfa" }} />
          <span style={{ color: "#94a3b8" }}>ROAS:</span>
          <span className="font-semibold text-white ml-auto pl-3">
            {raw.roas > 0 ? `${raw.roas.toFixed(2)}x` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-3 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ color: "#94a3b8" }}>Inversión:</span>
          <span style={{ color: "#94a3b8" }} className="ml-auto pl-3">{fCurrency(raw.spend)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DailyRevenueChartProps {
  data: DailyInsightsPoint[];
  loading?: boolean;
}

const TICK_COLOR = "#64748b";
const BAR_COLOR = "#604ad9";
const LINE_COLOR = "#a78bfa";

function RevenueBarLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, value } = props;
  if (!value) return null;
  const label = "$" + new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const cy = height < 22 ? y + height / 2 + 4 : y + 14;
  return (
    <text x={x + width / 2} y={cy} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize={10} fontWeight={600}>
      {label}
    </text>
  );
}

export function DailyRevenueChart({ data, loading }: DailyRevenueChartProps) {
  if (loading) {
    return (
      <div className="h-72 rounded-xl border border-border bg-card animate-pulse flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Cargando gráfico…</span>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="h-72 rounded-xl border border-border bg-card flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Sin datos para el período seleccionado.</span>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const maxRoas = Math.max(...data.map((d) => d.roas), 1);

  return (
    <div className="rounded-xl border border-border bg-card px-6 pt-5 pb-4">
      {/* Header */}
      <div className="flex items-center gap-5 mb-5">
        <h3 className="text-sm font-semibold text-foreground">Facturación y ROAS</h3>
        <div className="flex items-center gap-5 ml-auto">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#94a3b8" }}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BAR_COLOR }} />
            Facturación
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#94a3b8" }}>
            <span className="w-5 border-t-2 border-dashed" style={{ borderColor: LINE_COLOR }} />
            ROAS
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={270}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            dy={8}
            interval="preserveStartEnd"
          />

          {/* Left: revenue */}
          <YAxis
            yAxisId="left"
            orientation="left"
            tick={{ fontSize: 11, fill: TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            domain={[0, Math.ceil(maxRevenue * 1.4)]}
            tickFormatter={(v: number) =>
              v >= 1000000
                ? `$${(v / 1000000).toFixed(1)}M`
                : v >= 1000
                ? `$${new Intl.NumberFormat("es-AR").format(Math.round(v / 1000))}k`
                : `$${v}`
            }
            dx={-4}
            width={52}
          />

          {/* Right: ROAS */}
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            domain={[0, Math.ceil(maxRoas * 1.4)]}
            tickFormatter={(v: number) => `${v.toFixed(1)}x`}
            dx={4}
            width={40}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />

          <Bar
            yAxisId="left"
            dataKey="revenue"
            fill={BAR_COLOR}
            fillOpacity={0.8}
            radius={[4, 4, 0, 0]}
            maxBarSize={52}
            label={<RevenueBarLabel />}
          />

          <Line
            yAxisId="right"
            dataKey="roas"
            stroke={LINE_COLOR}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ fill: LINE_COLOR, r: 3.5, strokeWidth: 0 }}
            activeDot={{ r: 5.5, fill: LINE_COLOR, strokeWidth: 0 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
