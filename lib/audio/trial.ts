"use client";

import { PROOF } from "@/lib/site";

const KEY = "odatone.player.trial.v1";
const DAY = 24 * 60 * 60 * 1000;

export type TrialState = {
  started: boolean;
  startedAt: number | null;
  daysLeft: number;
  expired: boolean;
};

export const TRIAL_DAYS = PROOF.playerTrialDays;

function read(): number | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function trialState(): TrialState {
  if (typeof window === "undefined") {
    return { started: false, startedAt: null, daysLeft: TRIAL_DAYS, expired: false };
  }
  const startedAt = read();
  if (startedAt === null) {
    return { started: false, startedAt: null, daysLeft: TRIAL_DAYS, expired: false };
  }
  const elapsed = Date.now() - startedAt;
  const daysLeft = Math.max(0, Math.ceil((TRIAL_DAYS * DAY - elapsed) / DAY));
  return { started: true, startedAt, daysLeft, expired: elapsed >= TRIAL_DAYS * DAY };
}

/** Called the first time the visitor presses play. */
export function startTrial(): TrialState {
  if (typeof window === "undefined") return trialState();
  if (read() === null) {
    try {
      window.localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* private mode — the player still works, it just won't remember */
    }
  }
  return trialState();
}

export function resetTrial(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Backdate the trial so the expired state can be reviewed. */
export function expireTrial(): void {
  try {
    window.localStorage.setItem(KEY, String(Date.now() - (TRIAL_DAYS + 1) * DAY));
  } catch {
    /* ignore */
  }
}
