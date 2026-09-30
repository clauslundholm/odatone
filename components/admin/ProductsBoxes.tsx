"use client";

import { useCallback, useRef, useState } from "react";

import { Badge } from "@/components/admin/Badge";
import { Modal } from "@/components/admin/Modal";
import { AddonForm, DeleteProduct, PlanForm } from "@/components/admin/ProductsForm";
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
        <DeleteProduct kind="plan" id={plan.id} name={plan.name} onDeleted={close} />
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
        <DeleteProduct kind="addon" id={addon.id} name={addon.name.en} onDeleted={close} />
      </Modal>
    </>
  );
}

/** The dashed tile that opens an empty form. Kept in the same grid as the
    product boxes, and last, so "create" reads as one more card rather than a
    button floating above a heading — and so the grid does not change shape
    depending on whether anything exists yet.

    It deliberately does not look like a product box: same footprint, no
    price, no id, dashed border. Two boxes that differ only in their text is
    how a misclick on a grid of near-identical cards happens. */
function NewBox({
  label,
  onOpen,
  triggerRef,
}: {
  label: string;
  onOpen: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={onOpen}
      className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-line-strong bg-transparent p-5 text-ink-2 transition-colors hover:border-accent hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span aria-hidden className="text-[1.25rem] leading-none">+</span>
      <span className="text-[0.9375rem] font-medium">{label}</span>
    </button>
  );
}

export function NewPlanBox() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <NewBox label="New plan" onOpen={() => setOpen(true)} triggerRef={triggerRef} />
      <Modal open={open} onClose={close} title="New plan" trigger={triggerRef}>
        <PlanForm plan={null} onSaved={close} />
      </Modal>
    </>
  );
}

export function NewAddonBox() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <NewBox label="New add-on" onOpen={() => setOpen(true)} triggerRef={triggerRef} />
      <Modal open={open} onClose={close} title="New add-on" trigger={triggerRef}>
        <AddonForm addon={null} onSaved={close} />
      </Modal>
    </>
  );
}
