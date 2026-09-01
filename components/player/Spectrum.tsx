"use client";

/**
 * The analyser display. When nothing is playing the levels decay to zero,
 * which would leave an empty rectangle — so a low, static profile stands
 * in until the audio takes over.
 */
export default function Spectrum({
  levels,
  className = "",
  height = 120,
  mirror = false,
}: {
  levels: number[];
  className?: string;
  height?: number;
  mirror?: boolean;
}) {
  const peak = levels.length ? Math.max(...levels) : 0;
  const idleMix = peak < 0.04 ? 1 - peak / 0.04 : 0;

  return (
    <div
      aria-hidden="true"
      className={`flex w-full items-end gap-[3px] ${className}`}
      style={{ height }}
    >
      {levels.map((v, i) => {
        const idle = 0.05 + 0.11 * Math.abs(Math.sin(i * 0.62 + 1.1)) + 0.04 * ((i * 7) % 5) / 5;
        const value = Math.max(v, idle * idleMix);
        return (
          <span
            key={i}
            className="flex-1 origin-bottom rounded-[1px]"
            style={{
              height: `${Math.max(2, value * 100)}%`,
              backgroundColor: "var(--c-accent)",
              opacity: (mirror ? 0.35 : 0.28) + value * 0.7,
              transition: "height 90ms linear, opacity 90ms linear",
            }}
          />
        );
      })}
    </div>
  );
}
