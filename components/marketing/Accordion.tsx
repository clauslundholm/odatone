"use client";

import { useState } from "react";

export default function Accordion({
  items,
  className = "",
}: {
  items: string[][];
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className={`border-t border-line ${className}`}>
      {items.map(([q, a], i) => {
        const isOpen = open === i;
        return (
          <div key={q} className="border-b border-line">
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="group flex w-full items-start gap-5 py-6 text-left transition-colors hover:text-accent"
              >
                <span className="u-title flex-1 text-[1.0625rem] sm:text-[1.1875rem]">{q}</span>
                <span
                  aria-hidden="true"
                  className={`mt-1 shrink-0 text-ink-3 transition-transform duration-300 ${
                    isOpen ? "rotate-45" : ""
                  }`}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1.5v13M1.5 8h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              className="grid transition-[grid-template-rows] duration-400 ease-[cubic-bezier(.32,.72,0,1)]"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="max-w-[64ch] pb-7 text-[1rem] leading-relaxed text-ink-2">{a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
