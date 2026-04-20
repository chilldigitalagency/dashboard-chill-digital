"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PresetId =
  | "today"
  | "yesterday"
  | "last_7d"
  | "last_14d"
  | "last_30d"
  | "this_month"
  | "last_month";

export type DateSelection =
  | { type: "preset"; preset: PresetId }
  | { type: "custom"; since: string; until: string };

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "last_7d", label: "Últimos 7 días" },
  { id: "last_14d", label: "Últimos 14 días" },
  { id: "last_30d", label: "Últimos 30 días" },
  { id: "this_month", label: "Este mes" },
  { id: "last_month", label: "Mes pasado" },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const MONTHS_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
const MONTHS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function fmtShort(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function getPresetRange(preset: PresetId): { from: Date; to: Date } {
  const t = todayDate();
  const sub = (n: number) => {
    const d = new Date(t);
    d.setDate(d.getDate() - n);
    return d;
  };
  const yesterday = sub(1);
  switch (preset) {
    case "today":     return { from: t, to: t };
    case "yesterday": return { from: yesterday, to: yesterday };
    case "last_7d":   return { from: sub(7), to: yesterday };
    case "last_14d":  return { from: sub(14), to: yesterday };
    case "last_30d":  return { from: sub(30), to: yesterday };
    case "this_month":
      return { from: new Date(t.getFullYear(), t.getMonth(), 1), to: t };
    case "last_month":
      return {
        from: new Date(t.getFullYear(), t.getMonth() - 1, 1),
        to: new Date(t.getFullYear(), t.getMonth(), 0),
      };
  }
}

function selectionLabel(sel: DateSelection): string {
  if (sel.type === "preset")
    return PRESETS.find((p) => p.id === sel.preset)?.label ?? sel.preset;
  if (!sel.since || !sel.until) return "Personalizado";
  return `${fmtShort(new Date(sel.since + "T00:00:00"))} – ${fmtShort(
    new Date(sel.until + "T00:00:00")
  )}`;
}

// ─── Calendar months ──────────────────────────────────────────────────────────

interface CalMonth { year: number; month: number }

function prevCal(c: CalMonth): CalMonth {
  return c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 };
}
function nextCal(c: CalMonth): CalMonth {
  return c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 };
}

// ─── Custom calendar grid ─────────────────────────────────────────────────────

interface CalendarProps {
  cal: CalMonth;
  from: Date | null;
  to: Date | null;
  hover: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
  showPrev: boolean;
  showNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

function Calendar({
  cal, from, to, hover,
  onDayClick, onDayHover,
  showPrev, showNext, onPrev, onNext,
}: CalendarProps) {
  const { year, month } = cal;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Week starts Monday: offset = (sunday=0 → 6, monday=1 → 0, ..., saturday=6 → 5)
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const today = todayDate();

  // Effective range (accounting for hover preview)
  let effFrom = from;
  let effTo = to;
  if (from && !to && hover) {
    if (hover >= from) {
      effTo = hover;
    } else {
      effFrom = hover;
      effTo = from;
    }
  }

  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div className="w-56">
      {/* Month header */}
      <div className="flex items-center justify-between h-8 mb-2">
        <button
          onClick={onPrev}
          className={cn(
            "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
            "text-[#8884a0] hover:text-white hover:bg-white/10",
            !showPrev && "invisible pointer-events-none"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-white capitalize">
          {MONTHS_FULL[month]} {year}
        </span>
        <button
          onClick={onNext}
          className={cn(
            "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
            "text-[#8884a0] hover:text-white hover:bg-white/10",
            !showNext && "invisible pointer-events-none"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="h-8 w-8 flex items-center justify-center text-[11px] font-medium text-[#8884a0]">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} className="w-8 h-8" />;

          const isFrom = effFrom ? isSameDay(date, effFrom) : false;
          const isTo = effTo ? isSameDay(date, effTo) : false;
          const isSingle = isFrom && isTo;
          const inRange = effFrom && effTo && date > effFrom && date < effTo;
          const isToday = isSameDay(date, today);

          // Outer div handles range background strip
          const outerCn = cn(
            "w-8 h-8 flex items-center justify-center",
            inRange && "bg-[#604ad9]/20",
            isFrom && !isSingle && effTo && "bg-gradient-to-r from-transparent to-[#604ad9]/20",
            isTo && !isSingle && effFrom && "bg-gradient-to-l from-transparent to-[#604ad9]/20"
          );

          // Button handles selection circle
          const btnCn = cn(
            "w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors cursor-pointer",
            isFrom || isTo
              ? "text-white"
              : inRange
              ? "text-white hover:bg-white/10"
              : isToday
              ? "font-bold text-[#604ad9] hover:bg-white/10"
              : "text-[#ccc8e8] hover:bg-white/10"
          );

          return (
            <div key={date.toISOString()} className={outerCn}>
              <button
                className={btnCn}
                style={isFrom || isTo ? { background: "#604ad9" } : undefined}
                onClick={() => onDayClick(date)}
                onMouseEnter={() => onDayHover(date)}
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateSelection;
  onChange: (v: DateSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pendingType, setPendingType] = useState<"preset" | "custom">("preset");
  const [pendingPreset, setPendingPreset] = useState<PresetId>("last_7d");
  const [pendingFrom, setPendingFrom] = useState<Date | null>(null);
  const [pendingTo, setPendingTo] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);
  const [calMonth, setCalMonth] = useState<CalMonth>(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  function syncPending() {
    if (value.type === "preset") {
      const range = getPresetRange(value.preset);
      setPendingType("preset");
      setPendingPreset(value.preset);
      setPendingFrom(range.from);
      setPendingTo(range.to);
      setCalMonth({ year: range.from.getFullYear(), month: range.from.getMonth() });
    } else if (value.since && value.until) {
      const from = new Date(value.since + "T00:00:00");
      const to = new Date(value.until + "T00:00:00");
      setPendingType("custom");
      setPendingFrom(from);
      setPendingTo(to);
      setCalMonth({ year: from.getFullYear(), month: from.getMonth() });
    }
  }

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) syncPending();
    if (!isOpen) setHover(null);
    setOpen(isOpen);
  }

  function handleSelectPreset(id: PresetId) {
    const range = getPresetRange(id);
    setPendingType("preset");
    setPendingPreset(id);
    setPendingFrom(range.from);
    setPendingTo(range.to);
    setCalMonth({ year: range.from.getFullYear(), month: range.from.getMonth() });
  }

  function handleDayClick(date: Date) {
    setPendingType("custom");
    if (!pendingFrom || (pendingFrom && pendingTo)) {
      setPendingFrom(date);
      setPendingTo(null);
    } else {
      if (date < pendingFrom) {
        setPendingTo(pendingFrom);
        setPendingFrom(date);
      } else {
        setPendingTo(date);
      }
      setHover(null);
    }
  }

  function handleApply() {
    if (pendingType === "preset") {
      onChange({ type: "preset", preset: pendingPreset });
    } else if (pendingFrom && pendingTo) {
      onChange({ type: "custom", since: toISODate(pendingFrom), until: toISODate(pendingTo) });
    }
    setOpen(false);
  }

  const rightCal = nextCal(calMonth);
  const canApply =
    pendingType === "preset" || (pendingFrom !== null && pendingTo !== null);
  const isSelecting = pendingType === "custom" && pendingFrom !== null && pendingTo === null;

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors cursor-pointer">
        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span>{selectionLabel(value)}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-0.5" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8}>
          <Popover.Popup
            className="z-50 flex rounded-xl border border-[#2d2b3d] shadow-2xl overflow-hidden"
            style={{ background: "#1a1a24" }}
          >
            {/* ── Left: preset list ── */}
            <div
              className="w-44 flex flex-col py-3 shrink-0"
              style={{ borderRight: "1px solid #2d2b3d" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-2 text-[#6b6884]">
                Período
              </p>
              {PRESETS.map((preset) => {
                const active =
                  pendingType === "preset" && pendingPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id)}
                    className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-sm transition-colors"
                    style={
                      active
                        ? { background: "#604ad9", color: "#fff" }
                        : { color: "#ccc8e8" }
                    }
                    onMouseEnter={(e) => {
                      if (!active)
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "rgba(255,255,255,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active)
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "transparent";
                    }}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
                      style={{
                        borderColor: active ? "#fff" : "#6b6884",
                      }}
                    >
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* ── Right: calendars + footer ── */}
            <div className="flex flex-col">
              <div
                className="flex gap-8 px-6 pt-5 pb-3"
                onMouseLeave={() => setHover(null)}
              >
                <Calendar
                  cal={calMonth}
                  from={pendingFrom}
                  to={pendingTo}
                  hover={isSelecting ? hover : null}
                  onDayClick={handleDayClick}
                  onDayHover={(d) => setHover(d)}
                  showPrev
                  showNext={false}
                  onPrev={() => setCalMonth(prevCal(calMonth))}
                  onNext={() => {}}
                />
                <Calendar
                  cal={rightCal}
                  from={pendingFrom}
                  to={pendingTo}
                  hover={isSelecting ? hover : null}
                  onDayClick={handleDayClick}
                  onDayHover={(d) => setHover(d)}
                  showPrev={false}
                  showNext
                  onPrev={() => {}}
                  onNext={() => setCalMonth(nextCal(calMonth))}
                />
              </div>

              {/* Hint */}
              <p className="text-xs px-6 pb-1 h-5" style={{ color: "#6b6884" }}>
                {isSelecting ? "Seleccioná la fecha de fin" : ""}
              </p>

              {/* Footer */}
              <div
                className="flex items-center justify-end gap-2 px-4 py-3"
                style={{ borderTop: "1px solid #2d2b3d" }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="h-8 text-sm border-[#2d2b3d] text-[#ccc8e8] hover:bg-white/5 hover:text-white"
                  style={{ background: "transparent" }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={!canApply}
                  className="h-8 text-sm text-white hover:opacity-90 disabled:opacity-40"
                  style={{ background: "#604ad9" }}
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
