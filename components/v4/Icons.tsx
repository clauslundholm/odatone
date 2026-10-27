type P = { size?: number; className?: string };

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/* The left rail's five marks. Drawn here rather than taken from
   components/player/Icons.tsx because those are transport controls at a
   different weight — mixing the two sets made the rail read as two
   different icon families. */

export const HomeIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <path d="M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.6Z" />
  </svg>
);

export const SearchIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <circle cx="11" cy="11" r="6.4" />
    <path d="m16 16 4 4" />
  </svg>
);

export const CalendarIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <rect x="3.6" y="5.4" width="16.8" height="14.6" rx="2.4" />
    <path d="M3.6 10h16.8M8.4 3.4v3.4M15.6 3.4v3.4" />
  </svg>
);

export const SeasonIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <path d="M19.4 4.6c-7 0-11.2 2.8-12.4 7.6-.8 3.3.4 5.9 1.6 7.2" />
    <path d="M7.4 19.4C9 14.2 12.6 10.8 18 9.4" />
  </svg>
);

export const SlidersIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <path d="M4 7.5h11M4 12h7M4 16.5h13" />
    <circle cx="18" cy="7.5" r="2" />
    <circle cx="14" cy="12" r="2" />
  </svg>
);

export const PlusIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
);

export const HeartIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <path d="M12 19.6s-7.4-4.3-7.4-9a4 4 0 0 1 7.4-2.1A4 4 0 0 1 19.4 10.6c0 4.7-7.4 9-7.4 9Z" />
  </svg>
);

/**
 * The small equaliser mark the design lays over the bottom-left corner of
 * every photo tile — the sign that the tile plays rather than links.
 *
 * Static bars, not the animated components/ui/Equaliser: there are
 * seventeen of these on the page at once, and seventeen running CSS
 * animations under a photograph is motion nobody asked for.
 */
export const TilePlays = ({ className = "" }: { className?: string }) => (
  <svg
    width="22"
    height="18"
    viewBox="0 0 22 18"
    aria-hidden="true"
    className={className}
    fill="#ffffff"
  >
    {[7, 13, 17, 11, 6].map((h, i) => (
      <rect key={i} x={1 + i * 4.2} y={17 - h} width="2.6" height={h} rx="1.3" opacity={0.95} />
    ))}
  </svg>
);

/* ------------------------------------------------------- the planner */

export const GripIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
    {[6, 12, 18].flatMap((cy) => [9, 15].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" />))}
  </svg>
);

export const MoveIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <path d="M12 3v18M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3M9 6l3-3 3 3M9 18l3 3 3-3" />
  </svg>
);

export const KeyIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <rect x="2.6" y="6" width="18.8" height="12" rx="2.4" />
    <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8.5 14h7" />
  </svg>
);

export const TrashIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <path d="M3.5 6h17M8.5 6V4h7v2M18.5 6l-1 14h-11l-1-14" />
  </svg>
);

export const PinIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const CopyIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <rect x="9" y="9" width="12.4" height="12.4" rx="2.4" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4.6A2 2 0 0 1 4 2.6h8.4a2 2 0 0 1 2 2V5.6" />
  </svg>
);

export const CheckIcon = ({ size = 18, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** The mark on a scheduled announcement. Stroked rather than filled:
    at the 9px it is drawn at inside a pill, a solid horn collapses into
    an arrowhead and reads as "next" instead of "announcement". */
export const MegaphoneIcon = ({ size = 12, className = "" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} {...stroke}>
    <path d="m3 11 18-5v12L3 14v-3Z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);
