/**
 * The sidebar's glyph set. `NavItem` (components/admin/SideNav.tsx) has
 * carried an optional `icon` slot since the shell was first built, but
 * nothing ever filled it — every nav row was label-only. These fill it.
 *
 * All of them share one geometry so a column of them lines up: a 16×16
 * viewBox, 1.5px `currentColor` strokes, no fills. `currentColor` is what
 * lets a single glyph serve the muted resting row, the hover row and the
 * active row without three variants — SideNav sets the colour on the link
 * and the glyph follows it.
 */
type GlyphProps = { className?: string };

function Svg({ className, children }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className ?? ""}`}
    >
      {children}
    </svg>
  );
}

/** Four panes — the overview/dashboard row. */
export function GridGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="2" width="5" height="5" rx="1.2" />
      <rect x="9" y="2" width="5" height="5" rx="1.2" />
      <rect x="2" y="9" width="5" height="5" rx="1.2" />
      <rect x="9" y="9" width="5" height="5" rx="1.2" />
    </Svg>
  );
}

/** Two figures — the customers row. */
export function UsersGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="5.2" r="2.4" />
      <path d="M1.8 13.4a4.4 4.4 0 0 1 8.4 0" />
      <path d="M11 3.2a2.4 2.4 0 0 1 0 4.4M12.2 9.6a4.4 4.4 0 0 1 2 3.8" />
    </Svg>
  );
}

/** A carton — the products row. */
export function BoxGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M2 4.8 8 1.8l6 3v6.4l-6 3-6-3V4.8Z" />
      <path d="m2 4.8 6 3 6-3M8 7.8v7.4" />
    </Svg>
  );
}

/** Three faders — the settings row. */
export function SlidersGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3.4 13.2V9M3.4 6.4V2.8M8 13.2V8M8 5.4V2.8M12.6 13.2v-3.6M12.6 7V2.8" />
      <path d="M1.8 8h3.2M6.4 6.8h3.2M11 8.4h3.2" />
    </Svg>
  );
}

/** A roof and door — the portal's own overview row. */
export function HouseGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M2.2 6.6 8 2.2l5.8 4.4v6.2a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1V6.6Z" />
      <path d="M6.2 13.8V9.4h3.6v4.4" />
    </Svg>
  );
}

/** Sun, half-disc and moon — the three theme segments. */
export function SunGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.4v1.5M8 13.1v1.5M14.6 8h-1.5M2.9 8H1.4M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4 3.3 3.3" />
    </Svg>
  );
}

/** A pane with one half filled — the "follow the system" theme segment.
    A half-filled disc reads as a contrast or brightness control; the split
    pane is the convention for "whatever the OS is doing". */
export function SystemThemeGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <rect x="2.2" y="3" width="11.6" height="10" rx="2" />
      <path d="M8 3v10H4.2a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2H8Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function MoonGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8 5.6 5.6 0 1 0 13.2 9.6Z" />
    </Svg>
  );
}

/** Three dots — the user card's overflow trigger. */
export function EllipsisGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="3.2" cy="8" r="1.45" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.45" fill="currentColor" stroke="none" />
      <circle cx="12.8" cy="8" r="1.45" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** A right-pointing chevron — the breadcrumb separator. A slash sits on
    the text baseline and reads as part of a path; the chevron reads as a
    step between two places. */
export function ChevronRightGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="m6.2 3.4 5 4.6-5 4.6" />
    </Svg>
  );
}
