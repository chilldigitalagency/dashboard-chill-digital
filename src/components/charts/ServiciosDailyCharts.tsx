"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ServiciosDailyPoint } from "@/lib/meta-ads/client";

const BAR_COLOR  = "#604ad9";
const LINE_COLOR = "#818cf8";
const TICK_COLOR = "#64748b";

function fNum(v: number) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function fShort(v: number) {
  if (v >= 1000) return "$" + new Intl.NumberFormat("es-AR").format(Math.round(v / 1000)) + "k";
  return "$" + Math.round(v);
}
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [, month, day] = dateStr.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

function ChartSkeleton() {
  return (
    <div className="h-72 rounded-xl border border-border bg-card animate-pulse flex items-center justify-center">
      <span className="text-sm text-muted-foreground">Cargando gráfico…</span>
    </div>
  );
}

// Desktop: inside-bar label
function CountBarLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, value } = props;
  if (!value || height < 18) return null;
  return (
    <text x={x + width / 2} y={y + 14} textAnchor="middle" fill="#ffffff" fontSize={10} fontWeight={600} style={{ opacity: 0.9 }}>
      {Math.round(value)}
    </text>
  );
}

type TooltipEntry = { name?: string; value?: number };

// ─── IG Visits chart ──────────────────────────────────────────────────────────

type IgChartRow = ServiciosDailyPoint & { costPerVisit: number };

function IgTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const visits = payload.find((p) => p.name === "igVisits")?.value ?? 0;
  const cost = payload.find((p) => p.name === "costPerVisit")?.value ?? 0;
  return (
    <div style={{ background: "hsl(222 47% 11%)", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="font-semibold text-white mb-2">{formatDate(label ?? "")}</p>
      <div className="flex items-center gap-3 mb-1">
        <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: BAR_COLOR }} />
        <span style={{ color: "#94a3b8" }}>Visitas al perfil:</span>
        <span className="font-semibold text-white ml-auto pl-3">{Math.round(visits)}</span>
      </div>
      {cost > 0 && (
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0 border-2" style={{ borderColor: LINE_COLOR }} />
          <span style={{ color: "#94a3b8" }}>Costo por visita:</span>
          <span className="font-semibold text-white ml-auto pl-3">${fNum(cost)}</span>
        </div>
      )}
    </div>
  );
}

function MobileIgLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number; payload?: IgChartRow }) {
  const { x = 0, y = 0, width = 0, height = 0, value, payload } = props;
  if (!value) return null;
  const cpv = payload?.costPerVisit;
  const secondary = cpv && cpv > 0 ? `  ·  ${fShort(cpv)}` : "";
  return (
    <text x={x + width + 6} y={y + height / 2} dominantBaseline="middle" fill="#94a3b8" fontSize={11} fontWeight={500}>
      {Math.round(value)}{secondary}
    </text>
  );
}

function IgVisitsChart({ data, isMobile }: { data: ServiciosDailyPoint[]; isMobile: boolean }) {
  const chartData: IgChartRow[] = data.map((d) => ({
    ...d,
    costPerVisit: d.igVisits > 0 ? d.igSpend / d.igVisits : 0,
  }));
  const maxVisits = Math.max(...chartData.map((d) => d.igVisits), 1);
  const maxCost   = Math.max(...chartData.map((d) => d.costPerVisit), 1);

  return (
    <div className="rounded-xl border border-border bg-card px-3 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
        <h3 className="text-sm font-semibold text-foreground flex-1 min-w-0">Visitas al Perfil de Instagram y Costo por Visita</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "#94a3b8" }}>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: BAR_COLOR }} />Visitas al perfil IG</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed shrink-0" style={{ borderColor: LINE_COLOR }} />Costo por visita</span>
        </div>
      </div>

      {isMobile ? (
        <div className="overflow-y-auto" style={{ maxHeight: "62vh" }}>
          <div style={{ height: Math.max(chartData.length * 34, 100) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={chartData} margin={{ top: 2, right: 120, bottom: 2, left: 4 }}>
                <XAxis type="number" hide domain={[0, Math.ceil(maxVisits * 1.15)]} />
                <YAxis type="category" dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<IgTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="igVisits" fill={BAR_COLOR} fillOpacity={0.85} radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false} label={<MobileIgLabel />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={270}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 64, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} dy={8} interval="preserveStartEnd" />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} domain={[0, Math.ceil(maxVisits * 1.4)]} tickFormatter={(v: number) => String(Math.round(v))} dx={-4} width={44} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} domain={[0, Math.ceil(maxCost * 1.4)]} tickFormatter={fShort} dx={4} width={60} />
            <Tooltip content={<IgTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar yAxisId="left" dataKey="igVisits" fill={BAR_COLOR} fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={52} isAnimationActive={false} label={<CountBarLabel />} />
            <Line yAxisId="right" dataKey="costPerVisit" stroke={LINE_COLOR} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: LINE_COLOR, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Messages chart ───────────────────────────────────────────────────────────

type MsgChartRow = ServiciosDailyPoint & { costPerMsg: number };

function MsgTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const msgs = payload.find((p) => p.name === "messages")?.value ?? 0;
  const cost = payload.find((p) => p.name === "costPerMsg")?.value ?? 0;
  return (
    <div style={{ background: "hsl(222 47% 11%)", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="font-semibold text-white mb-2">{formatDate(label ?? "")}</p>
      <div className="flex items-center gap-3 mb-1">
        <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: BAR_COLOR }} />
        <span style={{ color: "#94a3b8" }}>Mensajes:</span>
        <span className="font-semibold text-white ml-auto pl-3">{Math.round(msgs)}</span>
      </div>
      {cost > 0 && (
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0 border-2" style={{ borderColor: LINE_COLOR }} />
          <span style={{ color: "#94a3b8" }}>Costo por mensaje:</span>
          <span className="font-semibold text-white ml-auto pl-3">${fNum(cost)}</span>
        </div>
      )}
    </div>
  );
}

function MobileMsgLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number; payload?: MsgChartRow }) {
  const { x = 0, y = 0, width = 0, height = 0, value, payload } = props;
  if (!value) return null;
  const cpm = payload?.costPerMsg;
  const secondary = cpm && cpm > 0 ? `  ·  ${fShort(cpm)}` : "";
  return (
    <text x={x + width + 6} y={y + height / 2} dominantBaseline="middle" fill="#94a3b8" fontSize={11} fontWeight={500}>
      {Math.round(value)}{secondary}
    </text>
  );
}

function MessagesChart({ data, isMobile }: { data: ServiciosDailyPoint[]; isMobile: boolean }) {
  const chartData: MsgChartRow[] = data.map((d) => ({
    ...d,
    costPerMsg: d.messages > 0 ? d.msgSpend / d.messages : 0,
  }));
  const maxMsgs = Math.max(...chartData.map((d) => d.messages), 1);
  const maxCost = Math.max(...chartData.map((d) => d.costPerMsg), 1);

  return (
    <div className="rounded-xl border border-border bg-card px-3 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
        <h3 className="text-sm font-semibold text-foreground flex-1 min-w-0">Mensajes y Costo por Mensaje</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "#94a3b8" }}>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: BAR_COLOR }} />Mensajes</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed shrink-0" style={{ borderColor: LINE_COLOR }} />Costo por mensaje</span>
        </div>
      </div>

      {isMobile ? (
        <div className="overflow-y-auto" style={{ maxHeight: "62vh" }}>
          <div style={{ height: Math.max(chartData.length * 34, 100) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={chartData} margin={{ top: 2, right: 120, bottom: 2, left: 4 }}>
                <XAxis type="number" hide domain={[0, Math.ceil(maxMsgs * 1.15)]} />
                <YAxis type="category" dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<MsgTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="messages" fill={BAR_COLOR} fillOpacity={0.85} radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false} label={<MobileMsgLabel />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={270}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 64, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} dy={8} interval="preserveStartEnd" />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} domain={[0, Math.ceil(maxMsgs * 1.4)]} tickFormatter={(v: number) => String(Math.round(v))} dx={-4} width={44} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} domain={[0, Math.ceil(maxCost * 1.4)]} tickFormatter={fShort} dx={4} width={60} />
            <Tooltip content={<MsgTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar yAxisId="left" dataKey="messages" fill={BAR_COLOR} fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={52} isAnimationActive={false} label={<CountBarLabel />} />
            <Line yAxisId="right" dataKey="costPerMsg" stroke={LINE_COLOR} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: LINE_COLOR, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Landing views chart ──────────────────────────────────────────────────────

type LandingChartRow = ServiciosDailyPoint & { costPerView: number };

function LandingTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const views = payload.find((p) => p.name === "landingViews")?.value ?? 0;
  const cost  = payload.find((p) => p.name === "costPerView")?.value ?? 0;
  return (
    <div style={{ background: "hsl(222 47% 11%)", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="font-semibold text-white mb-2">{formatDate(label ?? "")}</p>
      <div className="flex items-center gap-3 mb-1">
        <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: BAR_COLOR }} />
        <span style={{ color: "#94a3b8" }}>Visitas a la landing:</span>
        <span className="font-semibold text-white ml-auto pl-3">{Math.round(views)}</span>
      </div>
      {cost > 0 && (
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0 border-2" style={{ borderColor: LINE_COLOR }} />
          <span style={{ color: "#94a3b8" }}>Costo por visita:</span>
          <span className="font-semibold text-white ml-auto pl-3">${fNum(cost)}</span>
        </div>
      )}
    </div>
  );
}

function MobileLandingLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number; payload?: LandingChartRow }) {
  const { x = 0, y = 0, width = 0, height = 0, value, payload } = props;
  if (!value) return null;
  const cpv = payload?.costPerView;
  const secondary = cpv && cpv > 0 ? `  ·  ${fShort(cpv)}` : "";
  return (
    <text x={x + width + 6} y={y + height / 2} dominantBaseline="middle" fill="#94a3b8" fontSize={11} fontWeight={500}>
      {Math.round(value)}{secondary}
    </text>
  );
}

function LandingChart({ data, isMobile }: { data: ServiciosDailyPoint[]; isMobile: boolean }) {
  const chartData: LandingChartRow[] = data.map((d) => ({
    ...d,
    costPerView: d.landingViews > 0 ? d.landingSpend / d.landingViews : 0,
  }));
  const maxViews = Math.max(...chartData.map((d) => d.landingViews), 1);
  const maxCost  = Math.max(...chartData.map((d) => d.costPerView), 1);

  return (
    <div className="rounded-xl border border-border bg-card px-3 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
        <h3 className="text-sm font-semibold text-foreground flex-1 min-w-0">Visitas a la Landing Page y Costo por Visita</h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "#94a3b8" }}>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: BAR_COLOR }} />Visitas a la landing</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed shrink-0" style={{ borderColor: LINE_COLOR }} />Costo por visita</span>
        </div>
      </div>

      {isMobile ? (
        <div className="overflow-y-auto" style={{ maxHeight: "62vh" }}>
          <div style={{ height: Math.max(chartData.length * 34, 100) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={chartData} margin={{ top: 2, right: 120, bottom: 2, left: 4 }}>
                <XAxis type="number" hide domain={[0, Math.ceil(maxViews * 1.15)]} />
                <YAxis type="category" dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} width={50} />
                <Tooltip content={<LandingTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="landingViews" fill={BAR_COLOR} fillOpacity={0.85} radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false} label={<MobileLandingLabel />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={270}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 64, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} dy={8} interval="preserveStartEnd" />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} domain={[0, Math.ceil(maxViews * 1.4)]} tickFormatter={(v: number) => String(Math.round(v))} dx={-4} width={44} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: TICK_COLOR }} axisLine={false} tickLine={false} domain={[0, Math.ceil(maxCost * 1.4)]} tickFormatter={fShort} dx={4} width={60} />
            <Tooltip content={<LandingTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar yAxisId="left" dataKey="landingViews" fill={BAR_COLOR} fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={52} isAnimationActive={false} label={<CountBarLabel />} />
            <Line yAxisId="right" dataKey="costPerView" stroke={LINE_COLOR} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: LINE_COLOR, strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Parent component ─────────────────────────────────────────────────────────

interface ServiciosDailyChartsProps {
  data: ServiciosDailyPoint[];
  loading: boolean;
}

export function ServiciosDailyCharts({ data, loading }: ServiciosDailyChartsProps) {
  const isMobile = useIsMobile();

  if (loading) {
    return (
      <>
        <ChartSkeleton />
        <ChartSkeleton />
        <ChartSkeleton />
      </>
    );
  }

  const hasIg       = data.some((d) => d.igVisits > 0);
  const hasMessages = data.some((d) => d.messages > 0);
  const hasLanding  = data.some((d) => d.landingViews > 0);

  if (!hasIg && !hasMessages && !hasLanding) return null;

  return (
    <>
      {hasIg       && <IgVisitsChart  data={data} isMobile={isMobile} />}
      {hasMessages && <MessagesChart  data={data} isMobile={isMobile} />}
      {hasLanding  && <LandingChart   data={data} isMobile={isMobile} />}
    </>
  );
}
