"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const FORMAT_LABELS: Record<string, string> = {
  INSTAGRAM_STANDARD: "Instagram Feed",
  INSTAGRAM_STORY: "Instagram Stories",
};

const NATIVE_H = 540;

function getScale(html: string, availableW: number): number {
  const wMatch = html.match(/\bwidth="(\d+)"/i);
  const hMatch = html.match(/\bheight="(\d+)"/i);
  if (!wMatch || !hMatch) return 1;
  const iw = parseInt(wMatch[1]);
  const ih = parseInt(hMatch[1]);
  if (!iw || !ih) return 1;
  return Math.min(availableW / iw, NATIVE_H / ih, 1);
}

interface Preview { format: string; html: string }

interface AdPreviewModalProps {
  adId: string;
  adName: string;
  clientId: string;
  onClose: () => void;
}

export function AdPreviewModal({ adId, adName, clientId, onClose }: AdPreviewModalProps) {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [activeFormat, setActiveFormat] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableW, setAvailableW] = useState(476);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvailableW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/meta/ads/${adId}/preview?clientId=${clientId}`);
        const json = await res.json() as { previews?: Preview[]; error?: string };
        if (!res.ok || json.error) throw new Error(json.error ?? "Error al cargar vista previa");
        const p = json.previews ?? [];
        setPreviews(p);
        if (p.length) setActiveFormat(p[0].format);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [adId, clientId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const activePreview = previews.find((p) => p.format === activeFormat);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex flex-col w-full sm:max-w-[524px] rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl max-h-[92vh] sm:max-h-[700px]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-xs text-muted-foreground mb-0.5">Vista previa del anuncio</p>
            <h3 className="text-sm font-semibold text-foreground truncate">{adName}</h3>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Format tabs */}
        {previews.length > 1 && (
          <div className="flex gap-1 px-5 pt-3 shrink-0">
            {previews.map((p) => (
              <button
                key={p.format}
                onClick={() => setActiveFormat(p.format)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={
                  activeFormat === p.format
                    ? { background: "#604ad9", color: "#fff" }
                    : { color: "#94a3b8", background: "transparent" }
                }
              >
                {FORMAT_LABELS[p.format] ?? p.format}
              </button>
            ))}
          </div>
        )}

        {/* Preview area */}
        <div className="flex-1 min-h-0 flex items-center justify-center px-4 pb-5 pt-4 overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="h-8 w-8 rounded-full border-2 border-[#604ad9] border-t-transparent animate-spin" />
              <span className="text-sm">Cargando vista previa…</span>
            </div>
          )}
          {!loading && error && (
            <div className="text-center text-sm text-muted-foreground">{error}</div>
          )}
          {!loading && !error && !previews.length && (
            <div className="text-center text-sm text-muted-foreground">
              No hay vista previa disponible para este anuncio.
            </div>
          )}
          {!loading && activePreview && (
            <div
              ref={previewRef}
              style={{ width: "100%", height: NATIVE_H, position: "relative", overflow: "hidden" }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: `translate(-50%, -50%) scale(${getScale(activePreview.html, availableW)})`,
                  transformOrigin: "center center",
                }}
                dangerouslySetInnerHTML={{ __html: activePreview.html }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
