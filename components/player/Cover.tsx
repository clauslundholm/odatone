import type { Track } from "@/lib/tracks";

/**
 * Every track needs a face and there is no artwork, so each one gets a
 * deterministic tile: the brand gradient rotated by a hash of the id, over
 * a bar pattern sampled from the track's own waveform peaks.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export default function Cover({
  track,
  size = 44,
  className = "",
}: {
  track: Track | null;
  size?: number;
  className?: string;
}) {
  const radius = Math.max(5, Math.round(size * 0.22));

  if (!track) {
    return (
      <span
        aria-hidden="true"
        className={`block shrink-0 bg-surface-2 ${className}`}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  const h = hash(track.id);
  const angle = h % 360;
  const bars = 9;
  const step = Math.max(1, Math.floor(track.peaks.length / bars));

  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <svg width={size} height={size} viewBox="0 0 44 44" role="presentation">
        <defs>
          <linearGradient
            id={`cv-${track.id}`}
            gradientTransform={`rotate(${angle} 0.5 0.5)`}
          >
            <stop offset="0%" stopColor="#db00ff" />
            <stop offset="100%" stopColor="#3d7aff" />
          </linearGradient>
        </defs>
        <rect width="44" height="44" fill={`url(#cv-${track.id})`} />
        <g opacity="0.9">
          {Array.from({ length: bars }).map((_, i) => {
            const p = track.peaks[i * step] ?? 0.3;
            const hgt = Math.max(3, p * 24);
            return (
              <rect
                key={i}
                x={6 + i * 3.7}
                y={34 - hgt}
                width={2}
                height={hgt}
                rx={1}
                fill="#ffffff"
                opacity={0.42 + p * 0.5}
              />
            );
          })}
        </g>
      </svg>
    </span>
  );
}
