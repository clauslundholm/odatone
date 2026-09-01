import type { ReactNode } from "react";
import { Container } from "./Section";

/**
 * Every page opens the same way: a centred headline over a lot of space,
 * with an optional line of subhead and a pair of actions beneath.
 */
export default function PageHero({
  label,
  title,
  lede,
  actions,
  children,
  size = "md",
}: {
  label?: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
  children?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <section className="relative overflow-hidden">
      <Aurora />
      <Container className="relative z-[2]">
        <div className="flex flex-col items-center gap-6 pb-16 pt-32 text-center sm:pt-40 lg:pb-20 lg:pt-44">
          {label && (
            <p className="u-label u-rise text-accent" style={{ animationDelay: "0ms" }}>
              {label}
            </p>
          )}
          <h1
            className={`u-display ${
              size === "lg"
                ? "text-[clamp(2.75rem,7.5vw,5.5rem)]"
                : "text-[clamp(2.4rem,5.6vw,4.25rem)]"
            } max-w-[16ch]`}
          >
            {title.split("\n").map((line, i) => (
              <span
                key={i}
                className="block u-rise"
                style={{ animationDelay: `${60 + i * 80}ms` }}
              >
                {line}
              </span>
            ))}
          </h1>
          {lede && (
            <p className="u-lede u-rise max-w-[54ch]" style={{ animationDelay: "280ms" }}>
              {lede}
            </p>
          )}
          {actions && (
            <div
              className="u-rise mt-2 flex flex-wrap items-center justify-center gap-x-7 gap-y-3"
              style={{ animationDelay: "340ms" }}
            >
              {actions}
            </div>
          )}
          {children}
        </div>
      </Container>
    </section>
  );
}

/** A soft wash of the brand gradient behind a hero. */
export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}>
      <div
        className="absolute left-1/2 top-[-32%] h-[720px] w-[1100px] -translate-x-1/2 rounded-full opacity-[0.16] blur-[130px]"
        style={{ background: "var(--g-brand)" }}
      />
    </div>
  );
}
