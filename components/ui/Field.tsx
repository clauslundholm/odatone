"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type Common = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  className?: string;
};

const shell =
  "w-full rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 text-[0.9375rem] text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-ink-3 focus:border-accent focus:shadow-[0_0_0_3px_var(--c-accent-soft)]";

export function Field({
  label,
  name,
  error,
  hint,
  className = "",
  ...rest
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="u-label flex items-baseline gap-1.5 text-ink-2">
        {label}
        {hint && <span className="text-ink-3">({hint})</span>}
      </span>
      <input
        name={name}
        aria-invalid={error ? true : undefined}
        className={`${shell} ${error ? "border-warn" : ""}`}
        {...rest}
      />
      {error && <span className="text-[0.8125rem] text-warn">{error}</span>}
    </label>
  );
}

export function TextField({
  label,
  name,
  error,
  hint,
  className = "",
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="u-label flex items-baseline gap-1.5 text-ink-2">
        {label}
        {hint && <span className="text-ink-3">({hint})</span>}
      </span>
      <textarea
        name={name}
        rows={5}
        aria-invalid={error ? true : undefined}
        className={`${shell} resize-y ${error ? "border-warn" : ""}`}
        {...rest}
      />
      {error && <span className="text-[0.8125rem] text-warn">{error}</span>}
    </label>
  );
}
