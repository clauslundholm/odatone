import type { L10n } from "../i18n";
import { type Fallback, type ScheduleBlock } from "../schedule";

/* ==================================================================== *
 *  A week to play with, before there is an account
 *
 *  Every other v4 page works signed out: the library plays, the builder
 *  builds, the seasons change the room. Saving is the only thing that
 *  needs a profile, and the copy says so rather than the page refusing.
 *  The Ugeplan was the one screen that still opened on a login wall —
 *  arrived at from what looks like the public site, which makes it a
 *  dead end rather than a door.
 *
 *  So it opens on a week instead. Everything works: drag, move,
 *  stretch, copy, delete. Nothing is written anywhere a second person
 *  could read, because there is no customer to write it against. It
 *  lives in this browser and says so.
 * ==================================================================== */

export const DEMO_LOCATION_ID = "demo-location";

export const DEMO_LOCATION_NAME: L10n = { da: "Din butik", en: "Your shop" };

/** The curated lists, under the names components/v4/Landing.tsx gives
    them — which is also what lib/v4/list-look.ts keys its photography
    on, so a demo block looks like the tile it was dragged from. */
export const DEMO_LISTS: { id: string; name: L10n; basedOn: string }[] = [
  { id: "demo-morning", name: { da: "Morgenåbning", en: "Opening hours" }, basedOn: "morning" },
  { id: "demo-lunch", name: { da: "Frokostpuls", en: "Lunch pulse" }, basedOn: "lunch" },
  { id: "demo-friday", name: { da: "Fredag kl. 17", en: "Friday at five" }, basedOn: "friday" },
  { id: "demo-evening", name: { da: "Dansk på anlægget", en: "Danish on the system" }, basedOn: "evening" },
];

const H = (hour: number, min = 0) => hour * 60 + min;

/* A café's week, and a plausible one: the mornings are quiet, lunch
   picks up, Friday runs late and Sunday closes early. It is here to be
   edited, so it is deliberately not perfect — there are gaps to fill. */
export function starterWeek(): ScheduleBlock[] {
  const out: ScheduleBlock[] = [];
  let n = 0;
  const add = (weekday: number, from: number, to: number, playlistId: string) =>
    out.push({ id: `demo-${n++}`, playlistId, weekday, from, to });

  for (let d = 0; d < 4; d++) {
    add(d, H(8), H(10), "demo-morning");
    add(d, H(10), H(14), "demo-lunch");
    add(d, H(17), H(21), "demo-evening");
  }
  add(4, H(7, 30), H(10), "demo-morning");
  add(4, H(10), H(14), "demo-lunch");
  add(4, H(17), H(24), "demo-friday");
  add(5, H(9), H(12), "demo-morning");
  add(5, H(12), H(17), "demo-lunch");
  add(5, H(17), H(24), "demo-friday");
  add(6, H(10), H(16), "demo-lunch");
  return out;
}

export const DEMO_FALLBACK: Fallback = "silence";

/* ------------------------------------------------------------ storage */

const KEY = "odatone-demo-week-v1";

type Saved = { blocks: ScheduleBlock[]; fallback: Fallback };

/** Read the week back, or null for "never edited here".
 *
 *  Never called during render: localStorage does not exist on the
 *  server, and a component that read it while rendering would hydrate
 *  against markup built from the starter week and mismatch. The caller
 *  loads it in an effect and replaces what it has. */
export function loadDemoWeek(): Saved | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    if (!Array.isArray(parsed.blocks)) return null;
    /* Validated rather than trusted: this is a string a person can
       edit, and a block with no `to` would be dragged into a crash. */
    const blocks = parsed.blocks.filter(
      (b): b is ScheduleBlock =>
        !!b &&
        typeof b.id === "string" &&
        typeof b.playlistId === "string" &&
        Number.isInteger(b.weekday) &&
        Number.isInteger(b.from) &&
        Number.isInteger(b.to) &&
        b.from < b.to,
    );
    return { blocks, fallback: (parsed.fallback ?? DEMO_FALLBACK) as Fallback };
  } catch {
    return null;
  }
}

export function saveDemoWeek(saved: Saved): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* Private windows and blocked site data both throw here. The week
       still works for as long as the tab is open, which is the whole
       promise — so this is a no-op, not an error worth showing. */
  }
}

export function clearDemoWeek(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* as above */
  }
}
