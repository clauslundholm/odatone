import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "solid" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium tracking-[-0.008em] transition-[background-color,color,border-color,opacity,transform] duration-200 ease-[cubic-bezier(.32,.72,0,1)] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40";

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-[0.8125rem]",
  md: "px-5 py-2.5 text-[0.9375rem]",
  lg: "px-7 py-3.5 text-[1.0625rem]",
};

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:opacity-88",
  solid: "bg-ink text-bg hover:opacity-85",
  outline: "border border-line-strong text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:text-ink",
  quiet: "bg-surface-2 text-ink hover:bg-surface-3",
  /* --c-bad-ink (app/globals.css) is a per-theme pairing, not a fixed
     white: in dark mode --c-bad is a light #f27d7d, and white text on it
     measured ~2.6:1 (task-15 fix round 1's Minor) -- well under WCAG AA's
     4.5:1. --c-bad-ink flips to a dark ink in that theme instead, the same
     way --c-accent-ink is chosen per accent rather than assumed to always
     be white. */
  danger: "bg-bad text-bad-ink hover:opacity-85",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`;
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

/** The chevron that follows a text link. */
export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg width="7" height="11" viewBox="0 0 7 11" fill="none" aria-hidden="true" className={className}>
      <path d="M1.2 1.2 5.5 5.5 1.2 9.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Kept for call sites that read better with an arrow than a chevron. */
export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" className={className}>
      <path d="M2.5 7.5h9M8 4l3.5 3.5L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A text link with a chevron — the quiet secondary action. */
export function TextLink({
  children,
  className = "",
  ...rest
}: ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link className={`u-link ${className}`} {...rest}>
      {children}
      <Chevron />
    </Link>
  );
}
