"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart,
  BarChart,
  Bar,
  LabelList,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyInsightsPoint } from "@/lib/meta-ads/client";

function fCurrency(value: number) {
  return "$" + new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function fShort(value: number) {
  return value >= 1000
    ? "$" + new Intl.NumberFormat("es-AR").format(Math.round(value / 1000)) + "k"
    : fCurrency(value);
}

function fFull(v: number) {
  if (v >= 1000) return "$" + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(v));
  if (v >= 10) return "$" + Math.round(v);
  return "$" + v.toFixed(2);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [, month, day] = dateStr.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

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
          <span style={{ color: "#94a3b8" }}>Compras:</span>
          <span className="font-semibold text-white ml-auto pl-3">{raw.purchases}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex-shrink-0 w-2.5 border-t-2 border-dashed" style={{ borderColor: "#a78bfa" }} />
          <span style={{ color: "#94a3b8" }}>Costo por compra:</span>
          <span className="font-semibold text-white ml-auto pl-3">{raw.cpa > 0 ? fCurrency(raw.cpa) : "—"}</span>
        </div>
        <div className="flex items-center gap-3 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ color: "#94a3b8" }}>Inversión:</span>
          <span style={{ color: "#94a3b8" }} className="ml-auto pl-3">{fCurrency(raw.spend)}</span>
        </div>
      </div>
    </div>
  );
}

// Desktop: inside-bar label
function BarLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, value } = props;
  if (!value) return null;
  const cy = height < 22 ? y + height / 2 + 4 : y + 14;
  return (
    <text x={x + width / 2} y={cy} textAnchor="middle" fill="#ffffff" fontSize={11} fontWeight={600} style={{ opacity: 0.9 }}>
      {value}
    </text>
  );
}

function MobileLabel(props: { x?: string | number; y?: string | number; width?: string | number; height?: string | number; value?: unknown }) {
  const x = Number(props.x ?? 0), y = Number(props.y ?? 0), width = Number(props.width ?? 0), height = Number(props.height ?? 0);
  if (!props.value) return null;
  return (
    <text x={x + width + 6} y={y + height / 2} dominantBaseline="middle" fill="#94a3b8" fontSize={11} fontWeight={500}>
      {String(props.value)}
    </text>
  );
}

interface DailySalesChartProps {
  data: DailyInsightsPoint[];
  loading?: boolean;
}

const TICK_COLOR = "#64748b";
const BAR_COLOR = "#604ad9";
const LINE_COLOR = "#a78bfa";

export function DailySalesChart({ data, loading }: DailySalesChartProps) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  const maxPurchases = Math.max(...data.map((d) => d.purchases), 1);
  const maxCpa = Math.max(...data.map((d) => d.cpa), 1);

  return (
    <div className="rounded-xl border border-border bg-card px-3 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
        <h3 className="text-sm font-semibold text-foreground flex-1 min-w-0">Compras y Costo por Compra</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#94a3b8" }}>
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: BAR_COLOR }} />
            Compras
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#94a3b8" }}>
            <span className="w-5 border-t-2 border-dashed shrink-0" style={{ borderColor: LINE_COLOR }} />
            Costo por compra
          </div>
        </div>
      </div>

      {isMobile ? (
        /* ── Mobile: horizontal bars, vertical scroll ── */
        (() => {
          const mobileData = data.map((d) => ({
            ...d,
            _label: `${Math.round(d.purchases)}${d.cpa > 0 ? `  ·  ${fFull(d.cpa)}` : ""}`,
          }));
          return (
            <div className="overflow-y-auto" style={{ maxHeight: "62vh" }}>
              <div style={{ height: Math.max(data.length * 34, 100) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={mobileData} margin={{ top: 2, right: 130, bottom: 2, left: 4 }}>
                    <XAxis type="number" hide domain={[0, Math.ceil(maxPurchases * 1.15)]} />
                    <YAxis type="category" dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="purchases" fill={BAR_COLOR} fillOpacity={0.85} radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
                      <LabelList dataKey="_label" content={MobileLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()
      ) : (
        /* ── Desktop: vertical bar + line ── */
        <ResponsiveContainer width="100%" height={270}>
          <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} dy={8} interval="preserveStartEnd" />
            <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, Math.ceil(maxPurchases * 1.4)]} dx={-4} width={30} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} domain={[0, Math.ceil(maxCpa * 1.4)]} tickFormatter={(v: number) => v >= 1000 ? `$${new Intl.NumberFormat("es-AR").format(Math.round(v / 1000))}k` : `$${v}`} dx={4} width={48} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar yAxisId="left" dataKey="purchases" fill={BAR_COLOR} fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={52} label={<BarLabel />} isAnimationActive={false} />
            <Line isAnimationActive={false} yAxisId="right" dataKey="cpa" stroke={LINE_COLOR} strokeWidth={2} strokeDasharray="5 3" dot={{ fill: LINE_COLOR, r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5.5, fill: LINE_COLOR, strokeWidth: 0 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
