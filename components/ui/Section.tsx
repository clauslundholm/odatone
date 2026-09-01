import type { ReactNode } from "react";

/**
 * Layout primitives. The site is built from centred "moments": one idea
 * per section, a narrow measure for the words, and a lot of air around
 * everything.
 */

export function Container({
  children,
  className = "",
  wide = false,
  narrow = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
  narrow?: boolean;
}) {
  const width = narrow ? "max-w-[760px]" : wide ? "max-w-[1320px]" : "max-w-[1040px]";
  return (
    <div className={`mx-auto w-full px-6 sm:px-8 ${width} ${className}`}>{children}</div>
  );
}

export function Section({
  children,
  id,
  className = "",
  dark = false,
  tint = false,
  tight = false,
  rule = false,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
  dark?: boolean;
  /** A white band, to separate one moment from the off-white ground. */
  tint?: boolean;
  tight?: boolean;
  rule?: boolean;
}) {
  return (
    <section
      id={id}
      className={`relative ${dark ? "on-dark" : ""} ${tint ? "bg-surface" : ""} ${
        rule ? "border-t border-line" : ""
      } ${tight ? "py-16 sm:py-20" : "py-24 sm:py-32 lg:py-40"} ${className}`}
    >
      {children}
    </section>
  );
}

/** Small label above a headline. Used sparingly — most sections need none. */
export function Label({
  children,
  className = "",
  accent = false,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <p className={`u-label ${accent ? "text-accent" : "text-ink-3"} ${className}`}>{children}</p>
  );
}

export function SectionHead({
  label,
  title,
  lede,
  actions,
  align = "center",
  className = "",
  size = "md",
}: {
  label?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  align?: "center" | "left";
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const titleSize =
    size === "lg"
      ? "text-[clamp(2.4rem,6vw,4.5rem)]"
      : size === "sm"
        ? "text-[clamp(1.6rem,3.2vw,2.25rem)]"
        : "text-[clamp(2rem,4.6vw,3.5rem)]";

  return (
    <div
      className={`flex flex-col gap-5 ${
        align === "center" ? "items-center text-center" : "items-start"
      } ${className}`}
    >
      {label && <Label>{label}</Label>}
      <h2 className={`u-display max-w-[20ch] ${titleSize}`}>{title}</h2>
      {lede && (
        <p className={`u-lede max-w-[58ch] ${align === "center" ? "mx-auto" : ""}`}>{lede}</p>
      )}
      {actions && (
        <div
          className={`mt-2 flex flex-wrap items-center gap-x-7 gap-y-3 ${
            align === "center" ? "justify-center" : ""
          }`}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

/** A rounded tile. The grid unit for everything secondary. */
export function Tile({
  children,
  className = "",
  as: Tag = "div",
  flat = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
  flat?: boolean;
}) {
  const Component = Tag as "div";
  return (
    <Component
      className={`${flat ? "u-card-flat" : "u-card"} overflow-hidden p-7 sm:p-9 ${className}`}
    >
      {children}
    </Component>
  );
}

/** Legacy alias — several pages still call this. */
export const Eyebrow = Label;
