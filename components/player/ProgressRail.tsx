"use client";

import { useCallback, useRef, useState } from "react";

/**
 * The dock's scrubber. A waveform at 18px tall reads as static, so the bar
 * gets a plain rail that thickens on hover; the full waveform lives in the
 * expanded panel where it has room.
 */
export default function ProgressRail({
  progress,
  onSeek,
  label,
  className = "",
}: {
  progress: number;
  onSeek: (fraction: number) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const fractionFrom = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  }, []);

  const pct = Math.min(100, Math.max(0, (hover ?? progress) * 100));

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className={`group relative flex cursor-pointer items-center py-2.5 ${className}`}
      onPointerDown={(e) => {
        setDragging(true);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        onSeek(fractionFrom(e.clientX));
      }}
      onPointerMove={(e) => {
        setHover(fractionFrom(e.clientX));
        if (dragging) onSeek(fractionFrom(e.clientX));
      }}
      onPointerUp={() => setDragging(false)}
      onPointerLeave={() => {
        setHover(null);
        setDragging(false);
      }}
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
      <span className="relative block h-[3px] w-full bg-line-strong transition-[height] duration-150 group-hover:h-[5px]">
        <span
          className="absolute inset-y-0 left-0 bg-accent"
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
        {hover !== null && (
          <span
            className="absolute inset-y-0 left-0 bg-ink-3 opacity-40"
            style={{ width: `${pct}%` }}
          />
        )}
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          style={{ left: `${Math.min(100, progress * 100)}%` }}
        />
      </span>
    </div>
  );
}
