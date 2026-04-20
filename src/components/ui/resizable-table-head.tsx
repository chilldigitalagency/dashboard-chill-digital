"use client";

import { useState, useRef, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/components/ui/table";

export type SortDir = "asc" | "desc";

export function useResizableCols(initialWidths: Record<string, number>) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(initialWidths);
  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;

  const handleResizeStart = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidthsRef.current[colKey] ?? 160;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      setColWidths((prev) => ({
        ...prev,
        [colKey]: Math.max(80, startWidth + ev.clientX - startX),
      }));
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const totalWidth = Object.values(colWidths).reduce((a, b) => a + b, 0);

  return { colWidths, handleResizeStart, totalWidth };
}

interface THProps {
  colKey: string;
  activeSortKey: string | null;
  sortDir: SortDir;
  sortable?: boolean;
  sticky?: boolean;
  stickyLeft?: number;
  width: number;
  onSort?: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

export function TH({
  colKey,
  activeSortKey,
  sortDir,
  sortable,
  sticky,
  stickyLeft,
  width,
  onSort,
  onResizeStart,
  children,
}: THProps) {
  const isActive = activeSortKey === colKey;

  return (
    <TableHead
      style={{ width, position: "relative", paddingLeft: 0, paddingRight: 0, ...(sticky ? { left: stickyLeft ?? 0 } : {}) }}
      className={cn(
        "text-muted-foreground font-medium",
        sticky && "sticky z-10 bg-card",
        sortable && "cursor-pointer select-none"
      )}
      onClick={sortable && onSort ? onSort : undefined}
    >
      <div
        style={{ paddingLeft: 12, paddingRight: 16 }}
        className="flex items-center gap-1"
      >
        <span className="truncate">{children}</span>
        {isActive &&
          (sortDir === "desc" ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-primary" />
          ) : (
            <ChevronUp className="h-3 w-3 shrink-0 text-primary" />
          ))}
      </div>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 12,
          cursor: "col-resize",
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart(e);
        }}
        className="group/resizer"
      >
        <div
          style={{ width: 1, height: "60%", transition: "width 0.15s" }}
          className="bg-black/20 dark:bg-white/12 group-hover/resizer:!w-[2px] group-hover/resizer:!bg-primary/80"
        />
      </div>
    </TableHead>
  );
}
