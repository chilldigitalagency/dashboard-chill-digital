"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyInsightsPoint } from "@/lib/meta-ads/client";

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

interface CustomTooltipProps { active?: boolean; payload?: { value?: number; payload?: DailyInsightsPoint }[]; label?: string }

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "hsl(222 47% 11%)", border: "1px solid rgba(255,255,255,0.08)" }}
      className="rounded-xl px-4 py-3 shadow-xl text-sm"
    >
      <p className="font-semibold text-white mb-2">{formatDate(label ?? "")}</p>
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: "#604ad9" }} />
        <span style={{ color: "#94a3b8" }}>Inversión:</span>
        <span className="font-semibold text-white ml-auto pl-3">{fCurrency(payload[0]?.value ?? 0)}</span>
      </div>
    </div>
  );
}

function SpendBarLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, value } = props;
  if (!value) return null;
  const label = value >= 1000
    ? "$" + new Intl.NumberFormat("es-AR").format(Math.round(value / 1000)) + "k"
    : fCurrency(value);
  if (height < 18) return null;
  return (
    <text x={x + width / 2} y={y + 14} textAnchor="middle" fill="#ffffff" fontSize={10} fontWeight={600} style={{ opacity: 0.9 }}>
      {label}
    </text>
  );
}

interface DailySpendChartProps {
  data: DailyInsightsPoint[];
  loading?: boolean;
}

const TICK_COLOR = "#64748b";
const BAR_COLOR  = "#604ad9";

export function DailySpendChart({ data, loading }: DailySpendChartProps) {
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

  const maxSpend = Math.max(...data.map((d) => d.spend), 1);

  return (
    <div className="rounded-xl border border-border bg-card px-6 pt-5 pb-4">
      <div className="flex items-center gap-5 mb-5">
        <h3 className="text-sm font-semibold text-foreground">Inversión diaria</h3>
        <div className="flex items-center gap-1.5 text-xs ml-auto" style={{ color: "#94a3b8" }}>
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BAR_COLOR }} />
          Inversión
        </div>
      </div>

      <ResponsiveContainer width="100%" height={270}>
        <BarChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
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

          <YAxis
            tick={{ fontSize: 11, fill: TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            domain={[0, Math.ceil(maxSpend * 1.4)]}
            tickFormatter={(v: number) =>
              v >= 1000
                ? `$${new Intl.NumberFormat("es-AR").format(Math.round(v / 1000))}k`
                : `$${v}`
            }
            dx={-4}
            width={52}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />

          <Bar
            dataKey="spend"
            fill={BAR_COLOR}
            fillOpacity={0.8}
            radius={[4, 4, 0, 0]}
            maxBarSize={52}
            label={<SpendBarLabel />}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
