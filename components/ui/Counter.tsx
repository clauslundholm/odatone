"use client";

import { useEffect, useRef, useState } from "react";
import { num } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

/**
 * Counts up to `value` when scrolled into view, and re-animates whenever
 * the value changes (the calculator relies on that).
 */
export default function Counter({
  value,
  locale,
  duration = 900,
  className = "",
  decimals = 0,
}: {
  value: number;
  locale: Locale;
  duration?: number;
  className?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const from = useRef(0);
  const [display, setDisplay] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const start = from.current;
    const delta = value - start;
    if (delta === 0) {
      setDisplay(value);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      from.current = value;
      setDisplay(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(start + delta * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, visible, duration]);

  return (
    <span ref={ref} className={className}>
      {num(decimals ? display : Math.round(display), locale, decimals)}
    </span>
  );
}
