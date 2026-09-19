/* eslint-disable @next/next/no-img-element */

/**
 * The supplied wordmark — a 476×76 lockup in two variants.
 *
 * Only the "Oda" and the bars are gradient-filled; the "tone." letterforms
 * carry no fill at all and so render black. That is right on the light
 * page and invisible on the dark sidebar frame, where the wordmark sat
 * reading "Oda" alone. `tone="on-dark"` swaps in
 * `public/odatone-logo_on-dark.svg`, which differs from the colour file
 * only in giving those five paths `#f5f5f7`.
 *
 * Two files rather than one inlined SVG because this renders as an `<img>`
 * — `currentColor` cannot reach inside an external image.
 */
export default function Wordmark({
  height = 20,
  className = "",
  tone = "colour",
}: {
  height?: number;
  className?: string;
  tone?: "colour" | "on-dark";
}) {
  return (
    <img
      src={tone === "on-dark" ? "/odatone-logo_on-dark.svg" : "/odatone-logo_colour.svg"}
      alt="Odatone"
      width={Math.round(height * (476.01 / 76.12))}
      height={height}
      className={className}
      style={{ height, width: "auto" }}
      draggable={false}
    />
  );
}

/** The logo's own gradient as a standalone dot, for compact places. */
export function Mark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="oda-mark" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#db00ff" />
          <stop offset="1" stopColor="#3d7aff" />
        </linearGradient>
      </defs>
      <circle cx="7" cy="12" r="3.4" fill="url(#oda-mark)" />
      <path d="M12.4 7.4a6.6 6.6 0 0 1 0 9.2" stroke="url(#oda-mark)" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M16.2 4.6a11 11 0 0 1 0 14.8" stroke="url(#oda-mark)" strokeWidth="1.9" strokeLinecap="round" opacity="0.62" />
      <path d="M20 2.2a15.2 15.2 0 0 1 0 19.6" stroke="url(#oda-mark)" strokeWidth="1.9" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}
