"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Peaks-based scrubber. The bar count follows the measured width, so the
 * same 180-bucket data draws as ~60 bars on a phone and the full set on a
 * desktop — no sub-pixel bars, no minimum width forcing a scrollbar.
 */
export default function Waveform({
  peaks,
  progress,
  onSeek,
  height = 56,
  className = "",
  label,
}: {
  peaks: number[];
  progress: number;
  onSeek: (fraction: number) => void;
  height?: number;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [bars, setBars] = useState(90);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setBars(Math.max(32, Math.min(peaks.length || 90, Math.floor(w / 4))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [peaks.length]);

  const fractionFrom = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  }, []);

  const source = peaks.length ? peaks : new Array(90).fill(0.12);
  const sampled = Array.from({ length: bars }, (_, i) => {
    const lo = Math.floor((i / bars) * source.length);
    const hi = Math.max(lo + 1, Math.floor(((i + 1) / bars) * source.length));
    let max = 0;
    for (let j = lo; j < hi; j++) max = Math.max(max, source[j]);
    return max;
  });

  const playedTo = progress * bars;
  const hoverTo = hover === null ? null : hover * bars;

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className={`group relative flex w-full min-w-0 cursor-pointer items-end gap-px overflow-hidden ${className}`}
      style={{ height }}
      onClick={(e) => onSeek(fractionFrom(e.clientX))}
      onMouseMove={(e) => setHover(fractionFrom(e.clientX))}
      onMouseLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onSeek(Math.min(1, progress + 0.05));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          onSeek(Math.max(0, progress - 0.05));
        }
      }}
    >
      {sampled.map((p, i) => {
        const played = i < playedTo;
        const hovered = hoverTo !== null && i < hoverTo && !played;
        return (
          <span
            key={i}
            className="flex-1 rounded-[1px] transition-[background-color] duration-150"
            style={{
              height: `${Math.max(6, p * 100)}%`,
              backgroundColor: played
                ? "var(--c-accent)"
                : hovered
                  ? "var(--c-ink-2)"
                  : "var(--c-line-strong)",
            }}
          />
        );
      })}
    </div>
  );
}
