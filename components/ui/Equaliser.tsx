"use client";

type Props = {
  bars?: number;
  active?: boolean;
  className?: string;
  /** px height of the tallest bar */
  height?: number;
  width?: number;
  gap?: number;
};

/**
 * Purely decorative CSS equaliser. The player uses a real analyser
 * (components/player/Spectrum) — this one is for headers and buttons.
 */
export default function Equaliser({
  bars = 4,
  active = true,
  className = "",
  height = 14,
  width = 2,
  gap = 2,
}: Props) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-end ${className}`}
      style={{ height, gap }}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          style={{
            width,
            height,
            background: "currentColor",
            transformOrigin: "bottom",
            transform: active ? undefined : "scaleY(0.2)",
            animation: active
              ? `oda-bar ${0.72 + (i % 3) * 0.26}s ease-in-out ${i * 0.11}s infinite`
              : undefined,
          }}
        />
      ))}
    </span>
  );
}
