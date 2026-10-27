"use client";

import { v4 as t } from "@/lib/content/v4";
import type { Locale } from "@/lib/i18n";
import { listLook, listTile } from "@/lib/v4/list-look";
import {
  END,
  SNAP,
  START,
  WEEKDAYS,
  WEEKDAYS_INITIAL,
  type ScheduleBlock,
  distribution,
  hhmm,
  hoursLabel,
  plannedMinutes,
  quarterHours,
} from "@/lib/schedule";
import { CalendarIcon, GripIcon, KeyIcon, MoveIcon, PlusIcon, TrashIcon } from "../Icons";
import type { WeekList } from "./Week";

/**
 * The right-hand column: what you are editing, or — when nothing is
 * selected — what the week adds up to.
 *
 * The empty state is not a placeholder. It carries the four gestures the
 * grid supports, because none of them are discoverable by looking at a
 * grid, and under them the week's distribution, which is the question
 * someone opens this page to answer when they are not editing.
 */
export default function BlockPanel({
  locale: l,
  block,
  blocks,
  lists,
  copyDays,
  onToggleCopyDay,
  onCopy,
  onPatch,
  onDelete,
}: {
  locale: Locale;
  block: ScheduleBlock | null;
  blocks: ScheduleBlock[];
  lists: WeekList[];
  copyDays: number[];
  onToggleCopyDay: (d: number) => void;
  onCopy: () => void;
  onPatch: (patch: Partial<Pick<ScheduleBlock, "weekday" | "from" | "to" | "playlistId">>) => void;
  onDelete: () => void;
}) {
  if (!block) return <EmptyPanel locale={l} blocks={blocks} lists={lists} />;

  const list = lists.find((x) => x.id === block.playlistId);
  const look = listLook(list ?? { id: block.playlistId });

  return (
    <div className="oda-scroll flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto p-4">
      <div
        className="relative flex min-h-[170px] flex-col justify-end overflow-hidden rounded-[18px] p-4 text-white"
        style={{
          background: `linear-gradient(to top, rgba(0,0,0,.78), rgba(0,0,0,.1) 70%), ${listTile(look)}`,
        }}
      >
        <p className="text-[0.72rem] font-semibold opacity-90">
          {WEEKDAYS[block.weekday]![l]} · {hhmm(block.from)}–{hhmm(block.to)} ·{" "}
          {hoursLabel(block.to - block.from, l)}
        </p>
        <p className="u-display mt-0.5 text-[1.4rem]">{list?.name ?? "—"}</p>
      </div>

      <Field label={t.planner.list[l]}>
        <div className="grid grid-cols-2 gap-1.5">
          {lists.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => onPatch({ playlistId: x.id })}
              aria-pressed={x.id === block.playlistId}
              className={`flex min-w-0 items-center gap-2 rounded-[10px] border p-1.5 text-left text-[0.78rem] transition-colors ${
                x.id === block.playlistId
                  ? "border-accent bg-accent-soft font-semibold"
                  : "border-line hover:border-line-strong"
              }`}
            >
              <i
                aria-hidden="true"
                className="h-[26px] w-[26px] shrink-0 rounded-[7px]"
                style={{ background: listTile(listLook(x)) }}
              />
              <span className="truncate">{x.name}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label={t.planner.day[l]}>
        <select
          className="oda-input"
          value={block.weekday}
          onChange={(e) => onPatch({ weekday: Number(e.target.value) })}
        >
          {WEEKDAYS.map((d, i) => (
            <option key={i} value={i}>
              {d[l]}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label={t.planner.from[l]}>
          <select
            className="oda-input"
            value={block.from}
            onChange={(e) => onPatch({ from: Number(e.target.value) })}
          >
            {quarterHours(START, END - SNAP).map((m) => (
              <option key={m} value={m}>
                {hhmm(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.planner.to[l]}>
          <select
            className="oda-input"
            value={block.to}
            onChange={(e) => onPatch({ to: Number(e.target.value) })}
          >
            {quarterHours(START + SNAP, END).map((m) => (
              <option key={m} value={m}>
                {hhmm(m)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t.planner.copyTo[l]}>
        <div className="flex justify-between gap-1">
          {WEEKDAYS_INITIAL.map((d, i) => (
            <button
              key={i}
              type="button"
              disabled={i === block.weekday}
              title={WEEKDAYS[i]![l]}
              aria-pressed={copyDays.includes(i)}
              onClick={() => onToggleCopyDay(i)}
              className={`h-9 w-9 shrink-0 rounded-full border text-[0.78rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                copyDays.includes(i)
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line-strong hover:bg-surface-2"
              }`}
            >
              {d[l]}
            </button>
          ))}
        </div>
        <button type="button" onClick={onCopy} className="oda-btn-ghost mt-2 w-full">
          <CalendarIcon size={16} />
          {t.planner.copyGo[l]}
        </button>
      </Field>

      <div className="h-px bg-line" />

      <button
        type="button"
        onClick={onDelete}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-bad-soft text-[0.84rem] font-semibold text-bad transition-opacity hover:opacity-80"
      >
        <TrashIcon size={16} />
        {t.planner.deleteBlock[l]}
      </button>
    </div>
  );
}

function EmptyPanel({
  locale: l,
  blocks,
  lists,
}: {
  locale: Locale;
  blocks: ScheduleBlock[];
  lists: WeekList[];
}) {
  const rows = distribution(blocks);
  const max = rows.length ? rows[0]!.minutes : 1;
  const byId = new Map(lists.map((x) => [x.id, x]));

  const tips: [React.ReactNode, keyof typeof t.planner.tips][] = [
    [<PlusIcon key="a" size={15} />, "create"],
    [<GripIcon key="b" size={15} />, "drag"],
    [<MoveIcon key="c" size={15} />, "move"],
    [<KeyIcon key="d" size={15} />, "keys"],
  ];

  return (
    <div className="oda-scroll flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto p-4">
      <div className="pt-4 text-center">
        <div className="mx-auto mb-3 grid h-[52px] w-[52px] place-items-center rounded-[16px] bg-accent-soft text-accent">
          <CalendarIcon size={24} />
        </div>
        <h2 className="u-title text-[1rem] text-ink">{t.planner.emptyHeading[l]}</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-3">{t.planner.emptyLede[l]}</p>
      </div>

      <ul className="flex flex-col gap-2.5 rounded-[16px] bg-surface-2 p-3.5">
        {tips.map(([icon, key]) => (
          <li key={key} className="flex gap-2.5 text-[0.78rem] leading-relaxed text-ink-2">
            <span className="mt-0.5 shrink-0 text-accent">{icon}</span>
            <span>{t.planner.tips[key][l]}</span>
          </li>
        ))}
      </ul>

      {rows.length > 0 && (
        <Field label={t.planner.distribution[l]}>
          <div className="flex flex-col gap-2.5">
            {rows.map(({ playlistId, minutes }) => {
              const list = byId.get(playlistId);
              const look = listLook(list ?? { id: playlistId });
              return (
                <div
                  key={playlistId}
                  className="grid items-center gap-2.5 text-[0.78rem]"
                  style={{ gridTemplateColumns: "22px 1fr 44px" }}
                >
                  <i
                    aria-hidden="true"
                    className="h-[22px] w-[22px] rounded-[6px]"
                    style={{ background: listTile(look) }}
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-medium text-ink">{list?.name ?? "—"}</span>
                    <span className="h-1 overflow-hidden rounded bg-surface-3">
                      <span
                        className="block h-full rounded"
                        style={{
                          width: `${(minutes / max) * 100}%`,
                          background: `linear-gradient(90deg, ${look.light}, ${look.dark})`,
                        }}
                      />
                    </span>
                  </div>
                  <b className="u-tabular text-right font-semibold text-ink-2">
                    {hoursLabel(minutes, l)}
                  </b>
                </div>
              );
            })}
          </div>
          <p className="u-tabular mt-3 text-[0.75rem] text-ink-3">
            {t.planner.plannedTotal[l].replace("{hours}", hoursLabel(plannedMinutes(blocks), l))}
          </p>
        </Field>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="u-label text-ink-2">{label}</p>
      {children}
    </div>
  );
}
