/* ====================================================================
 *  The website's token set, ported.
 *
 *  Same values as app/globals.css in the Next.js project — light first,
 *  near-monochrome, and the only colour in the room comes from the
 *  logo's own gradient. Keep the two in step: if a hex changes on the
 *  web, change it here too.
 * ==================================================================== */

export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  lineStrong: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  warn: string;
  /** Solid black/white overlays, already alpha-composited for RN. */
  scrim: string;
};

export const LIGHT: Palette = {
  bg: "#f5f5f7",
  surface: "#ffffff",
  surface2: "#ececee",
  surface3: "#e2e2e5",
  ink: "#1c1c1e",
  ink2: "#6e6e73",
  ink3: "#8e8e93",
  line: "rgba(0,0,0,0.09)",
  lineStrong: "rgba(0,0,0,0.16)",
  accent: "#7a3aff",
  accentInk: "#ffffff",
  accentSoft: "#efe8ff",
  warn: "#c2410c",
  scrim: "rgba(255,255,255,0.94)",
};

export const DARK: Palette = {
  bg: "#0b0b0c",
  surface: "#141416",
  surface2: "#1c1c1f",
  surface3: "#26262a",
  ink: "#f5f5f7",
  ink2: "#a1a1a6",
  ink3: "#78787d",
  line: "rgba(255,255,255,0.10)",
  lineStrong: "rgba(255,255,255,0.20)",
  accent: "#8f4dff",
  accentInk: "#ffffff",
  accentSoft: "#231a3d",
  warn: "#ff8a4c",
  scrim: "rgba(20,20,22,0.92)",
};

/** The lockup's gradient — magenta → violet → blue. One accent, no more. */
export const BRAND = ["#db00ff", "#7a3aff", "#3d7aff"] as const;

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const SPACE = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Type ramp. The web uses Inter; RN gets the platform grotesque (SF Pro
 * on iOS, Roboto on Android), which sits close enough that bundling a
 * font file was not worth 400 KB. Letter spacing is what sells it —
 * the display sizes are tracked in hard, exactly like `.u-display`.
 */
export const TYPE = {
  display: { fontSize: 34, fontWeight: "700", letterSpacing: -1.1, lineHeight: 38 },
  title: { fontSize: 24, fontWeight: "700", letterSpacing: -0.7, lineHeight: 28 },
  section: { fontSize: 19, fontWeight: "600", letterSpacing: -0.4, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: "400", letterSpacing: -0.1, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2, lineHeight: 21 },
  small: { fontSize: 13, fontWeight: "400", letterSpacing: 0, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.1, lineHeight: 16 },
  num: { fontSize: 15, fontWeight: "600", letterSpacing: 0, lineHeight: 20 },
} as const;
