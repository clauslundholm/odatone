"use client";

import { useCallback, useRef, useState } from "react";

import { Badge } from "@/components/admin/Badge";
import { Modal } from "@/components/admin/Modal";
import { AddonForm, PlanForm } from "@/components/admin/ProductsForm";
import { formatDkk } from "@/lib/money";
import type { PlanRow } from "@/lib/plans-row";

type AddonRow = {
  id: string;
  name: { da: string; en: string };
  monthly_ore: number;
  active: boolean;
};

/**
 * The products screen at rest: one box per plan and per add-on, each a
 * button that opens its edit form in a dialog.
 *
 * Before this, every plan rendered its whole form permanently open — six
 * stacked cards of name, price, max area, two taglines, two feature
 * textareas and a toggle, with nothing to scan. The box shows what staff
 * actually come here to read (what it costs and whether it is live) and
 * keeps the twelve fields behind a deliberate click.
 *
 * Each box owns its own dialog rather than the page holding one shared
 * "which row is open" state. The forms are uncontrolled — every field is a
 * `defaultValue` — so a single reused dialog would need remounting per row
 * to refresh them, and an unmounted-per-row dialog is what that would
 * amount to anyway.
 */
function Box({
  title,
  id,
  price,
  meta,
  active,
  onOpen,
  triggerRef,
}: {
  title: string;
  id: string;
  price: string;
  meta?: string;
  active: boolean;
  onOpen: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={onOpen}
      className="flex flex-col items-start gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-5 text-left transition-colors hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <span className="text-[1.0625rem] font-medium text-ink">{title}</span>
        {!active && <Badge tone="neutral">Inactive</Badge>}
      </div>
      <span className="u-num text-[1.5rem] text-ink">{price}</span>
      <div className="flex w-full items-center justify-between gap-3">
        <span className="text-[0.8125rem] text-ink-2">{meta}</span>
        <span className="font-mono text-[0.75rem] text-ink-3">{id}</span>
      </div>
    </button>
  );
}

export function PlanBox({ plan }: { plan: PlanRow & { active: boolean } }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Box
        title={plan.name}
        id={plan.id}
        price={`${formatDkk(plan.monthly_ore, "en")} / location / month`}
        meta={plan.max_m2 ? `Up to ${plan.max_m2} m²` : "Unbounded area"}
        active={plan.active}
        onOpen={() => setOpen(true)}
        triggerRef={triggerRef}
      />
      <Modal open={open} onClose={close} title={`Edit ${plan.name}`} trigger={triggerRef}>
        <PlanForm plan={plan} onSaved={close} />
      </Modal>
    </>
  );
}

export function AddonBox({ addon }: { addon: AddonRow }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const title = `${addon.name.en} (add-on)`;

  return (
    <>
      <Box
        title={title}
        id={addon.id}
        price={`${formatDkk(addon.monthly_ore, "en")} / month`}
        active={addon.active}
        onOpen={() => setOpen(true)}
        triggerRef={triggerRef}
      />
      <Modal open={open} onClose={close} title={`Edit ${title}`} trigger={triggerRef}>
        <AddonForm addon={addon} onSaved={close} />
      </Modal>
    </>
  );
}
